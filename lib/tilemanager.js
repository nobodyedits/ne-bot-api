'use strict';

const { Direction, InvalidDirectionError } = require('./direction');

class Tile {
    /**
     * @private
     * @param {Object} data Data from JSON
     * @param {number} id The id
     */
    constructor(data, id) {
        // TODO: maybe store more info?

        // Feel free to read these fields
        this.id = id;
        this.minimapColor = data.color ? '#' + data.color : undefined;
        this.name = data.name;
        this.placeable = data.placeable !== undefined ? data.placeable : true;
    }

    /**
     * Returns the data class, null if none.
     */
    get dataClass() {
        return null;
    }

    /**
     * Does this tile accept the given tile data?
     * @param {Object} data The tile data
     * @return True if accepts, false otherwise
     */
    accepsData(data) {
        return this.dataClass ? data instanceof this.dataClass : false;
    }

    /**
     * @return {string}
     */
    toString() {
        return this.name;
    }
}

class VanishData {
    /**
     * Vanish data
     * @param {number} timeUntilVanished Time in seconds until the tile becomes vanished
     * @param {number} timeUntilReappeared Time in seconds until the tile reappears solid
     */
    constructor(timeUntilVanished, timeUntilReappeared) {
        if(!Number.isInteger(timeUntilVanished)) throw new TypeError('timeUntilVanished must be a number');
        if(timeUntilVanished < 1 || timeUntilVanished > 255) throw new RangeError('timeUntilVanished needs to be between 1 and 255 (inclusive)');
        if(!Number.isInteger(timeUntilReappeared)) throw new TypeError('timeUntilVanished must be a number');
        if(timeUntilReappeared < 1 || timeUntilReappeared > 255) throw new RangeError('timeUntilReappeared needs to be between 1 and 255 (inclusive)');
        this.timeUntilVanished = timeUntilVanished;
        this.timeUntilReappeared = timeUntilReappeared;
    }

    /**
     * Default data
     * @return {VanishData}
     */
    static get default() {
        return new this(1, 1);
    }

    /**
     * Constructs this from tile data
     * @param {number} data Tile data
     * @return {VanishData}
     */
    static fromSerialized(data) {
        return new this(data >> 8, data & 0xFF);
    }

    /**
     * @return {number}
     */
    serialize() {
        return (this.timeUntilVanished << 8) | this.timeUntilReappeared;
    }
}

class NumberData {
    /**
     * Number data
     * @param {number} value The value
     */
    constructor(value) {
        if(!Number.isInteger(value)) throw new TypeError('value must be a number');
        if(value < 0 || value > 16383) throw new RangeError('value needs to be between 0 and 16383 (inclusive)');
        this.value = value;
    }

    /**
     * Default data
     * @return {NumberData}
     */
    static get default() {
        return new this(0);
    }

    /**
     * Constructs this from tile data
     * @param {number} data Tile data
     * @return {NumberData}
     */
    static fromSerialized(data) {
        return new this(data);
    }

    /**
     * @return {number}
     */
    serialize() {
        return this.value;
    }
}

class PortalData {
    /**
     * Portal data
     * @param {number} myId This portals Id
     * @param {number} destinationId Portal destination Id
     * @param {number} direction Direction (see Direction enum)
     */
    constructor(myId, destinationId, direction) {
        if(!Number.isInteger(myId)) throw new TypeError('myId must be a number');
        if(myId < 0 || myId > 32767) throw new RangeError('myId needs to be between 0 and 32767 (inclusive)');
        if(!Number.isInteger(destinationId)) throw new TypeError('destinationId must be a number');
        if(destinationId < 0 || destinationId > 32767) throw new RangeError('destinationId needs to be between 0 and 32767 (inclusive)');
        if(!Object.values(Direction).includes(direction)) throw new InvalidDirectionError;
        this.myId = myId;
        this.destinationId = destinationId;
        this.direction = direction;
    }

    /**
     * Default data
     * @return {PortalData}
     */
    static get default() {
        return new this(0, 0, 0);
    }

    /**
     * Constructs this from tile data
     * @param {number} data Tile data
     * @return {PortalData}
     */
    static fromSerialized(data) {
        return new this((data >>> 2) & 32767, (data >>> (2 + 15)) & 32767, data & 3);
    }

    /**
     * @return {number}
     */
    serialize() {
        return this.direction | (this.myId << 2) | (this.destinationId << (2 + 15));
    }
}

class TextData {
    /**
     * Text data
     * @param {string} text The text
     */
    constructor(text) {
        if(typeof text !== 'string') throw new TypeError('text must be a string');
        if(text.length < 1 || text.length > 255) throw new RangeError('text length must be between 1 and 255 characters (inclusive)');
        this.text = text;
    }

    /**
     * Default data
     * @return {TextData}
     */
    static get default() {
        return new this(' ');
    }

    /**
     * Constructs this from tile data
     * @param {string} data Tile data
     * @return {TextData}
     */
    static fromSerialized(data) {
        return new this(data);
    }

    /**
     * @return {string}
     */
    serialize() {
        return this.text;
    }
}

class CoinSwitchableTile extends Tile {
    /** @inheritdoc */
    get dataClass() {
        return NumberData;
    }
}

class VanishTile extends Tile {
    /** @inheritdoc */
    get dataClass() {
        return VanishData;
    }
}

class PortalTile extends Tile {
    /** @inheritdoc */
    get dataClass() {
        return PortalData;
    }
}

class TextTile extends Tile {
    /** @inheritdoc */
    get dataClass() {
        return TextData;
    }
}

class TileManager {
    #foregrounds = [];
    #foregroundNameToId = new Map;
    #backgrounds = [];
    #backgroundNameToId = new Map;

    /**
     * @private
     * @param {Object} fg Foreground data from JSON
     * @param {Object} bg Background data from JSON
     */
    constructor(fg, bg) {
        const classLookup = {
            Vanish: VanishTile,
            GoldCoinDoor: CoinSwitchableTile,
            BlueCoinDoor: CoinSwitchableTile,
            GoldCoinGate: CoinSwitchableTile,
            BlueCoinGate: CoinSwitchableTile,
            MultipleGoldCoinDoor: CoinSwitchableTile,
            MultipleBlueCoinDoor: CoinSwitchableTile,
            MultipleGoldCoinGate: CoinSwitchableTile,
            MultipleBlueCoinGate: CoinSwitchableTile,
            Portal: PortalTile,
            Text: TextTile,
        };

        function helper(src, array, map) {
            let idx = 0;

            for(const category of src) {
                for(const obj of category.contents) {
                    const clazz = classLookup[obj.class] || Tile;

                    const t = new clazz(obj, idx);

                    array.push(t);
                    map.set(obj.name, idx);

                    ++idx;
                }
            }
        }

        helper(fg, this.#foregrounds, this.#foregroundNameToId);
        helper(bg, this.#backgrounds, this.#backgroundNameToId);
    }

    /**
     * Gets the background object from id
     * @param {number|string} idOrName The id or name
     * @return {Tile} The background
     */
    getBackground(idOrName) {
        if(typeof idOrName === 'number')
            return this.#backgrounds[idOrName];
        else
            return this.#backgrounds[this.getBackgroundId(idOrName)];
    }

    /**
     * @param {string} name The background name
     * @return {number} The id
     */
    getBackgroundId(name) {
        const x = this.#backgroundNameToId.get(name);
        if(x === undefined) throw new Error(`Unknown background '${name}'`);
        return x;
    }

    /**
     * Gets the foreground object from id
     * @param {number|string} idOrName The id or name
     * @return {Tile} The foreground
     */
    getForeground(idOrName) {
        if(typeof idOrName === 'number')
            return this.#foregrounds[idOrName];
        else
            return this.#foregrounds[this.getForegroundId(idOrName)];
    }

    /**
     * @param {string} name The foreground name
     * @return {number} The id
     */
    getForegroundId(name) {
        const x = this.#foregroundNameToId.get(name);
        if(x === undefined) throw new Error(`Unknown foreground '${name}'`);
        return x;
    }
}

module.exports = { TileManager, Tile, VanishData, NumberData, PortalData, TextData };
