'use strict';

const Packet = require('./packet');

class Player {
    #socket;
    #id;
    #name;
    #smileyBase;
    #smileyEyes;
    #smileyMouth;
    #smileyHat;
    #smileyOverlay;
    #lastSentX;
    #lastSentY;
    #xDir;
    #yDir;
    #god;
    #goldCoinCount;
    #blueCoinCount;
    #dead;

    /**
     * @private
     */
    constructor(socket, id, name, smileyBase, smileyEyes, smileyMouth, smileyHat, smileyOverlay, x, y, xDir, yDir, god, goldCoinCount, blueCoinCount, dead) {
        this.#socket = socket;
        this.#id = id;
        this.#name = name;
        this.#smileyBase = smileyBase;
        this.#smileyEyes = smileyEyes;
        this.#smileyMouth = smileyMouth;
        this.#smileyHat = smileyHat;
        this.#smileyOverlay = smileyOverlay;
        this.#lastSentX = x;
        this.#lastSentY = y;
        this.#xDir = xDir;
        this.#yDir = yDir;
        this.#god = god;
        this.#goldCoinCount = goldCoinCount;
        this.#blueCoinCount = blueCoinCount;
        this.#dead = dead;
    }

    /**
     * @type {number}
     */
    get id() {
        return this.#id;
    }

    /**
     * @type {string}
     */
    get name() {
        return this.#name;
    }

    /**
     * @type {number}
     */
    get smileyBase() {
        return this.#smileyBase;
    }

    /**
     * @type {number}
     */
    get smileyEyes() {
        return this.#smileyEyes;
    }

    /**
     * @type {number}
     */
    get smileyMouth() {
        return this.#smileyMouth;
    }

    /**
     * @type {number}
     */
    get smileyHat() {
        return this.#smileyHat;
    }

    /**
     * @type {number}
     */
    get smileyOverlay() {
        return this.#smileyOverlay;
    }

    /**
     * x move direction
     * @type {number}
     */
    get xDir() {
        return this._xDir;
    }

    /**
     * y move direction
     * @type {number}
     */
    get yDir() {
        return this._yDir;
    }

    /**
     * last sent x coordinate. Note: no physics simulation
     * @type {number}
     */
    get lastSentX() {
        return this.#lastSentX;
    }

    /**
     * last sent y coordinate. Note: no physics simulation
     * @type {number}
     */
    get lastSentY() {
        return this.#lastSentY;
    }

    /**
     * @type {boolean}
     */
    get god() {
        return this.#god;
    }

    /**
     * @type {number}
     */
    get goldCoinCount() {
        return this.#goldCoinCount;
    }

    /**
     * @type {number}
     */
    get blueCoinCount() {
        return this.#blueCoinCount;
    }

    /**
     * @type {boolean}
     */
    get dead() {
        return this.#dead;
    }

    /**
     * @private
     */
    _onMove(x, y, xDir, yDir, xSpeed, ySpeed) {
        this.#lastSentX = x;
        this.#lastSentY = y;
        this.#xDir = xDir;
        this.#yDir = yDir;
        // Requires physics simulation
        //this.#xSpeed = xSpeed;
        //this.#ySpeed = ySpeed;
    }

    /**
     * @private
     */
    _onToggleGod() {
        this.#god = !this.#god;
    }

    /**
     * @private
     */
    _onDeltaCoin(type, delta) {
        if(type === 0)
            this.#goldCoinCount += delta;
        else
            this.#blueCoinCount += delta;
    }

    /**
     * @private
     */
    _onRespawn() {
        this.#dead = false;
    }

    /**
     * @private
     */
    _onDie() {
        this.#dead = true;
        this.#xDir = 0;
        this.#yDir = 0;
    }

    /**
     * @private
     */
    _onReset() {
        this.#xDir = 0;
        this.#yDir = 0;
        this.#goldCoinCount = 0;
        this.#blueCoinCount = 0;
    }

    /**
     * Sets the permission of this player
     * @param {number} permission The permission level (see api.Permission)
     */
    setPermission(permission) {
        if(typeof permission !== "number") throw new TypeError("permission is of wrong type");
        this.#socket.emit(Packet.UPDATE_PERMS, [ this.#id, permission ]);
    }

    /**
     * Kicks this player
     * @param {number} timeInMinutes Time in minutes the kick lasts
     * @param {string} msg The kick message
     */
    kick(timeInMinutes, msg) {
        if(typeof timeInMinutes !== "number") throw new TypeError("timeInMinutes is of wrong type");
        if(typeof msg !== "string") throw new TypeError("msg is of wrong type");
        this.#socket.emit(Packet.KICK, [ this.#id, timeInMinutes, msg ]);
    }

    /**
     * @return {string}
     */
    toString() {
        return this.#name;
    }
}

module.exports = Player;
