'use strict';

const Packet = require('./packet');
const { Tile } = require('./tilemanager');
const EmitedValue = require('./emitedvalue');
const { Category, InvalidCategoryError } = require('./category');
const zlib = require('zlib');

/**
 * @private
 */
const DataLayerType =
{
    NOTHING:     0,
    UINT32:      1,
    TEXT:        2,
    UINT8:       3,
    UINT16:      4,
    VANISH:      5
};

class LocationOutOfBoundsError extends Error {
    /**
     * @private
     */
    constructor() {
        super('The location your provided is outside the room bounds');
        Error.captureStackTrace(this, LocationOutOfBoundsError);
    }
}

class TileNotPlaceableError extends Error {
    /**
     * @private
     */
    constructor() {
        super('The tile you provided is not placeable');
        Error.captureStackTrace(this, TileNotPlaceableError);
    }
}

/**
 * @private
 */
const MODIFICATION_TIME_THRESHOLD = 5; // ms

/**
 * Queueing changes together will result in less overhead.
 * It'll also likely hit the compression threshold (per message deflate).
 */
class ModificationQueue {
    #queue = [];
    #timer = null;
    #socket;
    #msg;

    /**
     * @private
     */
    constructor(socket, msg) {
        this.commit = this.commit.bind(this);
        this.#socket = socket;
        this.#msg = msg;
    }

    /**
     * @private
     */
    queue(x, y, id) {
        if(!this.#timer)
            this.#timer = setTimeout(this.commit, MODIFICATION_TIME_THRESHOLD);

        this.#queue.push(x, y, id);
    }

    /**
     * @private
     */
    commit() {
        this.#timer = null;
        this.#socket.emit(this.#msg, this.#queue);
        this.#queue = [];
    }

    /**
     * @private
     */
    forceCommit() {
        if(this.#timer) {
            clearTimeout(this.#timer);
            this.commit();
        }
    }
}

/**
 * A room.
 */
class Room {
    #api;
    #socket;
    #tm;
    #name;
    #code;
    #category;
    #visible;
    #autoSave;
    #allowSpectate;
    #allowParticleActs;
    #plays;
    #activeKeys;
    #width;
    #height;
    #fg;
    #bg;
    #dl;
    #goldCoinCount;
    #blueCoinCount;
    #goldCrownPlayer;
    #fgQueue;
    #bgQueue;
    #dQueue;

    /**
     * @private
     */
    constructor(api,
                socket,
                tm, 
                name,
                code,
                category,
                visible,
                autoSave,
                allowSpectate,
                allowParticleActs,
                plays,
                activeKeys,
                width,
                height,
                cFg,
                cBg,
                cDl,
                goldCoinCount,
                blueCoinCount,
                goldCrownPlayer) {
        const fg = new Uint16Array(zlib.inflateSync(new Uint8Array(cFg)).buffer);
        const bg = new Uint16Array(zlib.inflateSync(new Uint8Array(cBg)).buffer);

        this.#api = api;
        this.#socket = socket;
        this.#tm = tm;
        this.#name = new EmitedValue(name, this.#api.events, 'room:name');
        this.#code = new EmitedValue(code, this.#api.events, 'room:code');
        this.#category = new EmitedValue(category, this.#api.events, 'room:category');
        this.#visible = new EmitedValue(visible, this.#api.events, 'room:visible');
        this.#autoSave = new EmitedValue(autoSave, this.#api.events, 'room:autoSave');
        this.#allowSpectate = new EmitedValue(allowSpectate, this.#api.events, 'room:allowSpectate');
        this.#allowParticleActs = new EmitedValue(allowParticleActs, this.#api.events, 'room:allowParticleActions');
        this.#plays = new EmitedValue(plays, this.#api.events, 'room:plays');
        this.#activeKeys = new Set(activeKeys.map(k => api.tileManager.getForeground(k).name));
        this.#width = width;
        this.#height = height;
        this.#fg = fg;
        this.#bg = bg;
        this.#dl = this._readDataLayer(cDl);
        this.#goldCoinCount = goldCoinCount;
        this.#blueCoinCount = blueCoinCount;
        this.#goldCrownPlayer = goldCrownPlayer;
        this.#fgQueue = new ModificationQueue(socket, Packet.FOREGROUND);
        this.#bgQueue = new ModificationQueue(socket, Packet.BACKGROUND);
        this.#dQueue = new ModificationQueue(socket, Packet.FOREGROUND_DATA);

        // Register handlers
        this.#socket.on(Packet.PLAYCOUNT, this._onPlayCount.bind(this));
        this.#socket.on(Packet.LEAVE, this._onPlayerLeave.bind(this));
        this.#socket.on(Packet.CROWN, this._onCrown.bind(this));
        this.#socket.on(Packet.BACKGROUND_INFO, this._onBackgroundInfo.bind(this));
        this.#socket.on(Packet.FOREGROUND_DATA_INFO, this._onDataInfo.bind(this));
        this.#socket.on(Packet.FOREGROUND_INFO, this._onForegroundInfo.bind(this));
        this.#socket.on(Packet.CLEARROOM, this._onClear.bind(this));
        this.#socket.on(Packet.LOADROOM, this._onLoad.bind(this));
        this.#socket.on(Packet.SAVEROOM, this._onSave.bind(this));
        this.#socket.on(Packet.OWNERINFO, this._onOwnerInfo.bind(this));
        this.#socket.on(Packet.UPDATEINFO, this._onUpdateInfo.bind(this));
        this.#socket.on(Packet.ACTIVATEKEY, this._onActivateKey.bind(this));
        this.#socket.on(Packet.KEY_STATUS, this._onKeyStatus.bind(this));
    }

    /**
     * @private
     */
    _readDataLayer(cDl) {
        const buffer = zlib.inflateSync(cDl);
        const dl = new Array(this.#width * this.#height);

        let offset = 0;
        for(let y = 0; y < this.#height; ++y) {
            for(let x = 0; x < this.#width; ++x) {
                const type = buffer.readUInt8(offset++);

                switch(type)
                {
                    case DataLayerType.TEXT:
                        const length = buffer.readUInt8(offset++);
                        const b = buffer.slice(offset, offset + (length << 1));
                        dl[y * this.#width + x] = b.toString('utf16le');
                        offset += length << 1;
                        break;

                    case DataLayerType.UINT8:
                        dl[y * this.#width + x] = buffer.readUInt8(offset++);
                        break;

                    case DataLayerType.VANISH:
                    case DataLayerType.UINT16:
                        dl[y * this.#width + x] = buffer.readUInt16LE(offset);
                        offset += 2;
                        break;

                    case DataLayerType.UINT32:
                        dl[y * this.#width + x] = buffer.readUInt32LE(offset);
                        offset += 4;
                        break;
                }
            }
        }

        return dl;
    }

    /**
     * @private
     */
    _onClearLoadCommon() {
        for(const key of Array.from(this.#activeKeys)) {
            this._onKeyStatus(key, false);
        }
    }

    /**
     * @private
     */
    _onLoad([ cFg, cBg, cDl, goldCoins, blueCoins ]) {
        this.#fg = new Uint16Array(zlib.inflateSync(cFg));
        this.#bg = new Uint16Array(zlib.inflateSync(cBg));
        this.#dl = this._readDataLayer(cDl);
        this.#goldCoinCount = goldCoins;
        this.#blueCoinCount = blueCoins;

        this.#api.events.emit('room:load');

        this._onClearLoadCommon();
    }

    /**
     * @private
     */
    _onClear() {
        this.fg = new Uint16Array(this.#width * this.#height);
        this.bg = new Uint16Array(this.#width * this.#height);
        this.dl = new Array(this.#width * this.#height);

        const BORDER_TILE = this.#api.tileManager.getForeground('shiny light grey');
        for(let x = 0; x < this.#width; ++x)
        {
            this.fg[0 * this.#width + x] = BORDER_TILE;
            this.fg[(this.#height - 1) * this.#width + x] = BORDER_TILE;
        }
        for(let y = 0; y < this.#height; ++y)
        {
            this.fg[y * this.#width + 0] = BORDER_TILE;
            this.fg[y * this.#width + (this.#width - 1)] = BORDER_TILE;
        }

        this.#api.events.emit('room:clear');

        this._onClearLoadCommon();
    }

    /**
     * @private
     */
    _onSave(autosaved) {
        this.#api.events.emit('room:save', autosaved);
    }

    /**
     * @private
     */
    _onOwnerInfo([ code, category, visible, autoSave ]) {
        this.#code.value = code;
        this.#category.value = category;
        this.#visible.value = visible;
        this.#autoSave.value = autoSave;
    }

    /**
     * @private
     */
    _onUpdateInfo([ name, allowSpectate, allowParticleActs ]) {
        this.#name.value = name;
        this.#allowSpectate.value = allowSpectate;
        this.#allowParticleActs.value = allowParticleActs;
    }

    /**
     * @private
     */
    _onPlayCount(plays) {
        this.#plays.value = plays;
    }

    /**
     * @private
     */
    _onPlayerLeave([ pid ]) {
        if(this.#goldCrownPlayer && this.#goldCrownPlayer.id === pid)
            this._setGoldCrownPlayer(null);
    }

    /**
     * @private
     */
    _onCrown(pid) {
        this._setGoldCrownPlayer(this.#api.getPlayerById(pid));
    }

    /**
     * @private
     */
    _onBackgroundInfo([ x, y, bid, pid ]) {
        this._setBackgroundId(x, y, bid, this.#api.getPlayerById(pid));
    }

    /**
     * @private
     */
    _onForegroundInfo([ x, y, tid, pid ]) {
        this._setForegroundId(x, y, tid, this.#api.getPlayerById(pid));
    }

    /**
     * @private
     */
    _onDataInfo([ x, y, data, pid ]) {
        this._setDataSerialized(x, y, data, this.#api.getPlayerById(pid));
    }

    /**
     * @private
     */
    _onActivateKey([ pid, _, tile ]) {
        let name = this.#api.tileManager.getForeground(tile).name;
        this.#api.events.emit('player:key:activate', this.#api.getPlayerById(pid), name);
        this.#activeKeys.add(name);
    }

    /**
     * @private
     */
    _onKeyStatus([ tile ]) {
        let name = this.#api.tileManager.getForeground(tile).name;
        this.#api.events.emit('room:key:deactivate', name);
        this.#activeKeys.delete(name);
    }

    /**
     * @private
     */
    _setGoldCrownPlayer(player) {
        this.#api.events.emit('room:goldcrown', player);
        this.#goldCrownPlayer = player;
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
    get plays() {
        return this.#plays.value;
    }

    /**
     * @type {Array}
     */
    get activeKeys() {
        return Array.from(this.#activeKeys);
    }

    /**
     * @type {number}
     */
    get width() {
        return this.#width;
    }

    /**
     * @type {number}
     */
    get height() {
        return this.#height;
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
     * @type {Player}
     */
    get goldCrownPlayer() {
        return this.#goldCrownPlayer;
    }

    /**
     * Check if a key is active
     * @param {string} key The key name
     */
    isKeyActive(key) {
        return this.#activeKeys.has(key);
    }

    /**
     * Sets a key active/inactive
     * @param {string} key The key
     * @param {boolean} active True if the key is active
     */
    setKeyActive(key, active) {
        let id = this.#api.tileManager.getForegroundId(key);
        this.#socket.emit(Packet.ACTIVATEKEY, [ id, active ]);
    }

    /**
     * Checks if the coordinates are out of bounds
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @return {boolean} True if out of bounds, false otherwise
     */
    isOutOfBounds(x, y) {
        return x < 0 || y < 0 || x >= this.#width || y >= this.#height;
    }

    /**
     * @private
     */
    _getForegroundId(x, y)
    {
        if(this.isOutOfBounds(x, y)) return 0;
        return this.#fg[y * this.#width + x];
    }

    /**
     * Gets the foreground
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @return {Tile} The foreground
     */
    getForeground(x, y) {
        return this.#tm.getForeground(this._getForegroundId(x, y));
    }

    /**
     * Set the foreground
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @param {string|Tile} foreground The foreground
     */
    setForeground(x, y, foreground) {
        const tile = (foreground instanceof Tile) ? foreground : this.#tm.getForeground(foreground);
        if(!tile.placeable) throw new TileNotPlaceableError;
        const tid = tile.id;
        if(this._getForegroundId(x, y) === tid) return;
        this._setForegroundId(x, y, tid, null);
        this.#fgQueue.queue(x, y, tid);
    }

    /**
     * @private
     */
    _setForegroundId(x, y, tid, player) {
        if(this.isOutOfBounds(x, y)) throw new LocationOutOfBoundsError;
        const tile = this.#tm.getForeground(tid);
        if(player) this.#api.events.emit('room:fg', player, x, y, tile);
        this.#fg[y * this.#width + x] = tid;
        this.#dl[y * this.#width + x] = tile.dataClass ? tile.dataClass.default.serialize() : 0;
    }

    /**
     * Gets the data at a location
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @return {any} Tile data
     */
    getData(x, y) {
        const fg = this.getForeground(x, y);
        if(fg.dataClass) return fg.dataClass.fromSerialized(this.#dl[y * this.#width + x]);
        return null;
    }

    /**
     * Sets the data at a location
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @param {any} data The data
     */
    setData(x, y, data) {
        this.#fgQueue.forceCommit();
        this._setData(x, y, data, null);
        this.#dQueue.queue(x, y, data.serialize());
    }

    /**
     * @private
     */
    _setDataSerialized(x, y, data, player) {
        this._setData(x, y, this.getForeground(x, y).dataClass.fromSerialized(data), player);
    }

    /**
     * @private 
     */
    _setData(x, y, data, player) {
        if(this.isOutOfBounds(x, y)) throw new LocationOutOfBoundsError;
        if(!this.getForeground(x, y).accepsData(data)) throw new TypeError('Invalid tile data type');
        if(player) this.#api.events.emit('room:data', player, x, y, data);
        this.#dl[y * this.#width + x] = data.serialize();
    }

    /**
     * @private
     */
    _getBackgroundId(x, y)
    {
        if(this.isOutOfBounds(x, y)) return 0;
        return this.#bg[y * this.#width + x];
    }

    /**
     * Gets the background
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @return {Tile} The background
     */
    getBackground(x, y) {
        return this.#tm.getBackground(this._getBackgroundId(x, y));
    }

    /**
     * @private
     */
    _setBackgroundId(x, y, bid, player) {
        if(this.isOutOfBounds(x, y)) throw new LocationOutOfBoundsError;
        if(player) this.#api.events.emit('room:bg', player, x, y, this.#tm.getBackground(bid));
        this.#bg[y * this.#width + x] = bid;
    }

    /**
     * Set the background
     * @param {number} x The x coordinate
     * @param {number} y The y coordinate
     * @param {string|Tile} background The background
     */
    setBackground(x, y, background) {
        const tile = (background instanceof Tile) ? background : this.#tm.getBackground(background);
        const bid = tile.id;
        if(this._getBackgroundId(x, y) === bid) return;
        this._setBackgroundId(x, y, bid, null);
        this.#bgQueue.queue(x, y, bid);
    }

    /**
     * Saves the room
     */
    save() {
        this.#socket.emit(Packet.SAVEROOM);
    }

    /**
     * Resets player in the room
     */
    reset() {
        this.#socket.emit(Packet.RESETPLAYERS);
    }

    /**
     * Clears the room
     */
    clear() {
        this.#socket.emit(Packet.CLEARROOM);
    }

    /**
     * Load from savefile
     */
    load() {
        this.#socket.emit(Packet.LOADROOM);
    }

    /**
     * Sets dragging tiles in the room enabled/disabled
     * @param {boolean} enabled True if enabled, false otherwise
     */
    set drag(enabled) {
        this.#socket.emit(Packet.NODRAG, !enabled);
    }

    /**
     * @private
     */
    _sendSettings() {
        this.#socket.emit(Packet.OWNERINFO, [ this.#name.shadowValue, this.#code.shadowValue, this.#category.shadowValue, this.#visible.shadowValue, this.#autoSave.shadowValue, this.#allowSpectate.shadowValue, this.#allowParticleActs.shadowValue ]);
    }

    /**
     * Room name
     * @return {string}
     */
    get name() {
        return this.#name.value;
    }

    /**
     * Set room name
     * @param {string} value The new name
     */
    set name(value) {
        if(typeof value !== 'string') throw new TypeError('value must be a string');
        if(value.length < 1 || value.length > 30) throw new TypeError('name is too long');
        this.#name.value = value;
        this._sendSettings();
    }

    /**
     * Room code
     * @return {string}
     */
    get code() {
        return this.#code.value;
    }

    /**
     * Set room code
     * @param {string} value The new code
     */
    set code(value) {
        if(typeof value !== 'string') throw new TypeError('value must be a string');
        if(value.length > 20) throw new TypeError('code is too long');
        this.#code.value = value;
        this._sendSettings();
    }

    /**
     * Room category
     * @return {string}
     */
    get category() {
        return this.#category.value;
    }

    /**
     * Set room category
     * @param {string} value The new category
     */
    set category(value) {
        if(typeof value !== 'string') throw new TypeError('value must be a string');
        if(!Object.values(Category).includes(value)) throw new InvalidCategoryError;
        this.#category.value = value;
        this._sendSettings();
    }

    /**
     * Room visibility in lobby
     * @return {boolean}
     */
    get visible() {
        return this.#visible.value;
    }

    /**
     * Set room lobby visibility
     * @param {string} value The new lobby visibility
     */
    set visible(value) {
        if(typeof value !== 'boolean') throw new TypeError('value must be a boolean');
        this.#visible.value = value;
        this._sendSettings();
    }

    /**
     * Autosave
     * @return {boolean}
     */
    get autoSave() {
        return this.#autoSave.value;
    }

    /**
     * Set room auto-save setting
     * @param {boolean} value The new auto-save setting
     */
    set autoSave(value) {
        if(typeof value !== 'boolean') throw new TypeError('value must be a boolean');
        this.#autoSave.value = value;
        this._sendSettings();
    }

    /**
     * Allow spectate?
     * @return {boolean}
     */
    get allowSpectate() {
        return this.#allowSpectate.value;
    }

    /**
     * Set room allow spectate setting
     * @param {boolean} value The new allow spectate setting
     */
    set allowSpectate(value) {
        if(typeof value !== 'boolean') throw new TypeError('value must be a boolean');
        this.#allowSpectate.value = value;
        this._sendSettings();
    }

    /**
     * Allow player particles performing interactions?
     * @return {boolean}
     */
    get allowParticleActions() {
        return this.#allowParticleActs.value;
    }

    /**
     * Set room allow player particles performing interactions
     * @param {boolean} value The new allow particle actions setting
     */
    set allowParticleActions(value) {
        if(typeof value !== 'boolean') throw new TypeError('value must be a boolean');
        this.#allowParticleActs.value = value;
        this._sendSettings();
    }
}

module.exports = Room;
