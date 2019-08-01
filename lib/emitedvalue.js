'use strict';

/**
 * @private
 * A class that emits an event when its value has changed.
 */
class EmitedValue {
    #v;
    #shadowValue;
    #eventEmitter;
    #eventName;

    constructor(v, eventEmitter, eventName) {
        this.#v = v;
        this.#shadowValue = v;
        this.#eventEmitter = eventEmitter;
        this.#eventName = eventName;
    }

    set value(v) {
        if(this.#v !== v) {
            this.#shadowValue = v;
            this.#eventEmitter.emit(this.#eventName, v);
            this.#v = v;
        }
    }

    get value() {
        return this.#v;
    }

    get shadowValue() {
        return this.#shadowValue;
    }
}

module.exports = EmitedValue;
