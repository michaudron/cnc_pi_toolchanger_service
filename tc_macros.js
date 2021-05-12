class Macro {
    stopSpindle(pause, relay) {
        return `
        %wait
        ; Stop spindle
        M5
        ; wiat 5 seconds for the spindle to  stop
        G4 P${pause}
        %tc_relay ${relay}
        `;
    }
    gotoToolPickupLocation(slot, ctx, relay) {
        let slotX = ctx.machine.toolSlots[slot];
        return `
            %wait
            G90
            ; Raise to tool change Z
            G53 Z${ctx.machine.toolBase.zsafe}
            G53 X${slotX} Y${ctx.machine.toolBase.ypos}
            G53 Z${ctx.machine.toolBase.zpos}
            %wait
            %tc_relay ${relay}
        `;
    }
    gotoToolDropLocation(slot, ctx, relay) {
        let slotX = ctx.machine.toolSlots[slot];
        return `
            %wait
            G90
            ; Raise to tool change Z
            G53 Z${ctx.machine.toolBase.zsafe}
            G53 X${slotX} Y${ctx.machine.toolBase.ysafe}
            G53 Z${ctx.machine.toolBase.zpos}
            G53 Y${ctx.machine.toolBase.ypos}
            %wait
            %tc_relay ${relay}
        `;
    }
    gotoToolSafeZ(ctx, relay) {
        return `
            %wait
            Z${ctx.machine.toolBase.zsafe}
            %wait
            %tc_relay ${relay}
        `;
    }
    gotoToolSafeY(ctx, relay) {
        return `
            %wait
            G53 Y${ctx.machine.toolBase.ysafe}
            %wait
            %tc_relay ${relay}
        `
    }
    resume(pause) {
        return `
            %wait
            G4 P${pause}
            %resume
        `;
    }

    macroDoProbe(probe, originalOffset) {
        const PROBE_FEEDRATE = 20;
        return `
            ; Go to Clearance Height
            G53 Z${probe.zsafe}
            %wait
            ; Go to tool probe X,Y
            G53 X${probe.xpos} Y${probe.ypos}
            ; Wait until the planner queue is empty
            %wait

            ; Cancel tool length offset
            G49

            ; Probe toward workpiece with a maximum probe distance
            G91
            G38.2 Z${probe.distance} F${PROBE_FEEDRATE}
            G90
            ; A dwell time of one second to make sure the planner queue is empty
            G4 P1

            ; Update the tool length offset
            G43.1 Z[posz - ${originalOffset}]

            ; Retract from the touch plate
            G91 ; Relative positioning
            G0 Z${probe.zsafe}
            G90 ; Absolute positioning
        `;
    }

    restoreMachine(ctx, relay) {
        return `
            %wait
            ; Go to previous work position
            G0 X${ctx.posx} Y${ctx.posx}
            G0 Z${ctx.posz}
            ; Restore modal state
            ${ctx.modal.wcs} ${ctx.modal.plane} ${ctx.modal.units} ${ctx.modal.feedrate} ${ctx.modal.spindle} ${ctx.modal.coolant}
            %wait
            %tc_relay ${relay}
        `;
    }
};

module.exports = new Macro();