'use strict';
const io = require('socket.io')();

const ON = 1;
const OFF = 0;

var socket = null;
var checker = null;
var lastSent = null;

let state = {
	toolRelease: 0,
	toolBlowout: 0,
	toolSensors: [0, 1, 1, 1, 1, 0, 0, 0]
}

function log(data, extended) {
	console.log(data, extended || "");
}

function toolReleaseOn() {
	state.toolRelease = 1;
}

function toolReleaseOff() {
	state.toolRelease = 0;
}

function toolBlowoutOn()  {
	state.toolBlowout = 1;
}

function toolBlowoutOff()  {
	state.toolBlowout = 0;
}

function onError(error) {
	log(error);
}

function onDisconnect() {
	log("disconnected");
	socket.emit('toolchange:disconnected');
	cleanup();
}

io.on('connection', (soc) => {
	lastSent = null;
	socket = soc;
	socket.on('toolchange:release_on', toolReleaseOn);
	socket.on('toolchange:release_off', toolReleaseOff);
	socket.on('toolchange:blowout_on', toolBlowoutOn);
	socket.on('toolchange:blowout_off', toolBlowoutOff);
	socket.on('toolchange:status', sendState);
	
	socket.on('disconnect', onDisconnect);
	socket.on('error', onError);

	socket.emit('toolchange:connected');
	log("connected");
});

function formatStatus() {
	return `TR:${state.toolRelease},TB:${state.toolBlowout},${state.toolSensors.join(',')}`;
}

function sendState() {
	socket.emit('toolchange:status', formatStatus());
}

function checkSend() {
	let currentState = formatStatus();

	if (lastSent !== currentState) {
		log("send status", currentState);
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
		state.toolSensors[7] = state.toolSensors[7] === 0 ? 1 : 0; 
		checkSend();
	}, 5000);
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
log("Listening on 3001");
