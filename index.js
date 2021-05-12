'use strict';
const Gpio = require('onoff').Gpio; // Gpio class
const io = require('socket.io')();
const toolRelease = new Gpio(21, 'low');
const toolBlowout = new Gpio(20, 'low');
const ON = 1;
const OFF = 0;
const macros = require('./tc_macros');
const config = require('./config');
const RESUME = '%resume';

const RELAY_CHANGE_TOOL= 'changetool';
const RELAY_GET_NEW_TOOL = 'getnewtool';
const RELAY_GET_TOOL = 'gettool';
const RELAY_RETURN_TOOL = 'returntool'
const RELAY_GET_NEW_TOOL_OVER_TOOL = 'getnewovertool';
const RELAY_DROP_IN_TOOL_SLOT = 'dropintoolslot';
const RELAY_CLOSE_RELEASE_END = 'closerelease';
const RELAY_RESTORE_MACHINE = 'restoremachine';
const RELAY_RESUME = 'resume';
const ACTION_CHANGE_TOOL = 'changetool';
const ACTION_RETURN_TOOL = 'returntool';
const ACTION_GET_TOOL = 'gettool';

let sensors = [
	new Gpio(2, 'in', 'both'),
	new Gpio(3, 'in', 'both')
];

let socket = null;
let checker = null;
let lastSent = null;
let savedState = config.load();

let state = savedState || {
	action: null,
	ctx: null,
	toolInSpindle: null,
	toolRelease: 0,
	toolBlowout: 0,
	toolSensors: [0, 0, 0, 0, 0, 0, 0, 0]
}

function log(data, extended) {
	if (socket) {
		socket.emit('toolchange:log', data);
	}
	console.log(data, extended || '');
}

function toolReleaseOn() {	
	toolRelease.writeSync(ON);
	state.toolRelease = 1;
}

function toolReleaseOff() {
	toolRelease.writeSync(OFF);
	state.toolRelease = 0;
}

function toolBlowoutOn()  {
	toolBlowout.writeSync(ON);
	state.toolBlowout = 1;
}

function toolBlowoutOff()  {
	toolBlowout.writeSync(OFF);
	state.toolBlowout = 0;
}

function onError(error) {
	log(error);
}

function onDisconnect() {
	log("disconnected");
	socket.emit('toolchange:disconnected');
	toolReleaseOff();
	toolBlowoutOff();
}

io.on('connection', (soc) => {
	lastSent = null;
	socket = soc;
	socket.on('toolchange:release_on', toolReleaseOn);
	socket.on('toolchange:release_off', toolReleaseOff);
	socket.on('toolchange:blowout_on', toolBlowoutOn);
	socket.on('toolchange:blowout_off', toolBlowoutOff);
	socket.on('toolchange:change', changeTool);
	socket.on('toolchange:gettool', getTool);
	socket.on('toolchange:returntool', returnTool);
	socket.on('toolchange:relay', toolChangeRelay);
	socket.on('toolchange:status', sendState);
	socket.on('disconnect', onDisconnect);
	socket.on('error', onError);
	socket.emit('toolchange:connected');
	log("connected");
});

function changeTool(context) {
	state.action = ACTION_CHANGE_TOOL;
	state.ctx = context;
	socket.emit('toolchange:runmacro', macros.stopSpindle((context.modal.spindle === 'M5' ? 0 : 5), RELAY_CHANGE_TOOL));
	log(`Change tool ${context.newTool}`);
}

function getTool(context) {
	state.action = ACTION_GET_TOOL;
	state.ctx = context;
	socket.emit('toolchange:runmacro', macros.stopSpindle((context.modal.spindle === 'M5' ? 0 : 5), RELAY_GET_TOOL));
	log(`Get tool ${context.newTool}`);
}

function returnTool(context) {
	state.action = ACTION_RETURN_TOOL;
	state.ctx = context;
	socket.emit('toolchange:runmacro', macros.stopSpindle((context.modal.spindle === 'M5' ? 0 : 5), RELAY_RETERN_TOOL));
	log(`Get tool ${context.newTool}`);
}

function toolChangeRelay(data) {
	if (!state.action) {
		log('No action in progress');
		return;
	}
	const command = data.replace('%tc_relay', '').trim();
	log(`Relay command: ${command}`);

	switch(command) {
		case RELAY_CHANGE_TOOL:
			if(state.toolInSpindle) {
				if(state.toolInSpindle === state.ctx.newTool) {
					socket.emit('toolchange:runmacro', `
						;Tool already in spindle
						${RESUME}`);
						state.action = null;
					return;
				} else{
					socket.emit('toolchange:runmacro', macros.gotoToolDropLocation(state.toolInSpindle, state.ctx, RELAY_DROP_IN_TOOL_SLOT));
				}
			} else {
				socket.emit('toolchange:runmacro', macros.gotoToolPickupLocation(state.ctx.newTool, state.ctx, RELAY_GET_NEW_TOOL_OVER_TOOL));
			}		
			break;
		case RELAY_GET_TOOL:
			log(`get tool relay ${state.ctx.newTool}`);
			socket.emit('toolchange:runmacro', macros.gotoToolPickupLocation(state.ctx.newTool, state.ctx, RELAY_GET_TOOL_OVER_TOOL));
			break;
		case RELAY_GET_TOOL_OVER_TOOL:
			toolReleaseOff();
			state.toolInSpindle = state.ctx.newTool;
			socket.emit('toolchange:runmacro', macros.gotoToolSafeY(state.ctx, RELAY_RESUME));			
			break;
		case RELAY_RETURN_TOOL:
			log('return tool relay');
			break;
		case RELAY_DROP_IN_TOOL_SLOT:
			toolReleaseOn();
			state.toolInSpindle = null;
			let nextAction = RELAY_CLOSE_RELEASE_END;
			if(state.action === ACTION_CHANGE_TOOL) {
				nextAction = RELAY_GET_NEW_TOOL;
			}
			socket.emit('toolchange:runmacro', macros.gotoToolSafeZ(state.ctx, nextAction));
			break;
		case RELAY_GET_NEW_TOOL:
				toolReleaseOn();
				socket.emit('toolchange:runmacro', macros.gotoToolPickupLocation(state.ctx.newTool, state.ctx, RELAY_GET_NEW_TOOL_OVER_TOOL));
				break;
		case RELAY_CLOSE_RELEASE_END:
				toolReleaseOff();
				socket.emit('toolchange:runmacro', RELAY_RESUME);
				break;
		case RELAY_GET_NEW_TOOL_OVER_TOOL:
			toolReleaseOff();
			state.toolInSpindle = state.ctx.newTool;
			socket.emit('toolchange:runmacro', macros.gotoToolSafeY(state.ctx, RELAY_RESTORE_MACHINE));
			break;
		case RELAY_RESTORE_MACHINE:
			socket.emit('toolchange:runmacro', macros.restoreMachine(state.ctx, RELAY_RESUME));
			break;
		case RELAY_RESUME:
			socket.emit('toolchange:runmacro', macros.resume(2));
			break;
	}
}

function formatStatus() {
	return `TR:${state.toolRelease},TB:${state.toolBlowout},TS:${state.toolInSpindle ? state.toolInSpindle : ''},${state.toolSensors.join(',')}`;
}

function pollState() {
	sensors.forEach(function(item, index) {
		state.toolSensors[index] = item.readSync() ? 0: 1;
	});
};

function sendState() {
	socket.emit('toolchange:status', formatStatus());
}

function checkSend() {
	let currentState = formatStatus();

	if (lastSent !== currentState) {
		log(`Status changed: ${currentState}`);
		config.save(state);
		if (socket) {
			socket.emit('toolchange:status', currentState);
		}
		lastSent = currentState;
	}	
};

function statrPoller() {
	if(checker) {
		clearInterval(checker); 
	}

	checker = setInterval(function() {
		pollState();
		checkSend();
	}, 1000);
};

function cleanup() {
	if(checker) {
		clearInterval(checker); 
	}
	toolReleaseOff();
	toolBlowoutOff();
}

function unexportOnClose() {
	cleanup();
	process.exit();
};

statrPoller();

process.on('SIGINT', unexportOnClose); //function to run when user closes using ctrl+cc

io.listen(3001);

