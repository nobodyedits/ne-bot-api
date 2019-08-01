'use strict';

const Player = require('./player');
const Packet = require('./packet');
const Room = require('./room');
const { TileManager, VanishData, NumberData, PortalData, TextData } = require('./tilemanager');
const fetch = require('node-fetch');
const EventEmitter = require('events');

/**
 * Notes:
 * We chose to use a 'public getter, private setter' pattern to protect internals and avoid touching things people shouldn't.
 * This requires some extra setup unfortunately.
 * IMPORTANT NOTE: You should _never_ hardcode IDs, they might change in the future! Only use them when they come from a non-hardcoded source.
 */

/**
 * @private
 * @type {string}
 */
const DOMAIN = 'https://nobodyedits.fun';

/**
 * @private
 * @type {string}
 */
const PATH = '/';

/**
 * @private
 * @type {number}
 */
const PROTOCOL_VERSION = 0;

/**
 * @private
 * @type {number}
 */
const CHAT_DELAY = 300;

/**
 * @private
 * @type {number}
 */
const CHAT_MAX_LEN = 300;

class API {
    #socket;
    #tm;
    #room;
    #playerIds = new Map;
    #events = new EventEmitter;
    #lastChatTime = 0;

    /**
     * @private
     */
    constructor(
                socket,
                tm,
                width,
                height,
                cFg,
                cBg,
                cDl,
                players,
                goldCrown,
                goldCoinCount,
                blueCoinCount,
                name,
                editCode,
                category,
                visible,
                autosave,
                allowSpectate,
                allowParticleActs,
                plays,
                activeKeys) {
        this.#socket = socket;
        this.#tm = tm;

        // Register listeners
        this.#socket.on('disconnect', this._onDisconnect.bind(this));
        this.#socket.on(Packet.KICK, this._onKick.bind(this));
        this.#socket.on(Packet.JOIN, this._onPlayerJoin.bind(this));
        this.#socket.on(Packet.LEAVE, this._onPlayerLeave.bind(this));
        this.#socket.on(Packet.CHAT, this._onChat.bind(this));
        this.#socket.on(Packet.MOVE, this._onMove.bind(this));
        this.#socket.on(Packet.JUMP, this._onJump.bind(this));
        this.#socket.on(Packet.GOD, this._onGod.bind(this));
        this.#socket.on(Packet.REMOVECOIN, this._onRemoveCoin.bind(this));
        this.#socket.on(Packet.ADDCOIN, this._onAddCoin.bind(this));
        this.#socket.on(Packet.TP_TO_PLAYER, this._onTpToPlayer.bind(this));
        this.#socket.on(Packet.RESPAWN, this._onRespawn.bind(this));
        this.#socket.on(Packet.DIE, this._onDie.bind(this));
        this.#socket.on(Packet.RESET, this._onReset.bind(this));

        for(const p of players)
            this._onPlayerJoin(p);

        this.#room = new Room(this,
                              socket,
                              tm,
                              name,
                              editCode,
                              category,
                              visible,
                              autosave,
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
                              this.getPlayerById(goldCrown) || null);
    }

    /**
     * @private
     */
    _onKick(msg) {
        this.#events.emit('bot:kick', msg);
    }

    /**
     * @private
     */
    _onDisconnect() {
        this.#events.emit('bot:disconnect');
    }

    /**
     * @private
     */
    _onPlayerJoin(data) {
        const player = new Player(this.#socket, ...data);
        this.#playerIds.set(player.id, player);
        this.#events.emit('player:joined', player);
    }

    /**
     * @private
     */
    _onPlayerLeave([ id ]) {
        const player = this.#playerIds.get(id);
        this.#events.emit('player:left', player);

        this.#playerIds.delete(id);
    }

    /**
     * @private
     */
    _onChat([ pid, msg ]) {
        if(pid === -2) return;

        if(pid === -1)
            this.#events.emit('system:chat', msg);
        else
            this.#events.emit('player:chat', this.#playerIds.get(pid), msg);
    }

    /**
     * @private
     */
    _onMove(data) {
        const id = data.shift();
        const player = this.#playerIds.get(id);
        this.#events.emit('player:move', player, ...data);
        player._onMove(...data);
    }

    /**
     * @private
     */
    _onJump([ id ]) {
        const player = this.#playerIds.get(id);
        this.#events.emit('player:jump', player);
    }

    /**
     * @private
     */
    _onGod([ id ]) {
        const player = this.#playerIds.get(id);
        this.#events.emit('player:togglegod', player);
        player._onToggleGod();
    }

    /**
     * @private
     */
    _onDeltaCoin(id, _, type, delta) {
        const player = this.#playerIds.get(id);
        const name = (type === 0) ? 'gold' : 'blue';
        const suffix = (delta > 0) ? 'got' : 'lost';
        this.#events.emit(`player:coin:${name}:${suffix}`, player, player[`${name}CoinCount`] + delta);
        player._onDeltaCoin(type, delta);
    }

    /**
     * @private
     */
    _onRemoveCoin(data) {
        this._onDeltaCoin(...data, -1);
    }

    /**
     * @private
     */
    _onAddCoin(data) {
        this._onDeltaCoin(...data, 1);
    }

    /**
     * @private
     */
    _onTpToPlayer([ src, dst ]) {
        this.#events.emit('player:tp:toplayer', this.#playerIds.get(src), this.#playerIds.get(dst));
    }

    /**
     * @private
     */
    _onRespawn([ id, x, y ]) {
        const player = this.#playerIds.get(id);
        this.#events.emit('player:respawn', player, x, y);
        player._onRespawn();
    }

    /**
     * @private
     */
    _onDie([ id ]) {
        const player = this.#playerIds.get(id);
        this.#events.emit('player:die', player);
        player._onDie();
    }

    /**
     * @private
     */
    _onReset([ id, x, y ]) {
        const player = this.#playerIds.get(id);
        this.#events.emit('player:reset', player, x, y);
        player._onReset();
    }

    /**
     * @type {Room}
     */
    get room() {
        return this.#room;
    }

    /**
     * @type {EventEmitter}
     */
    get events() {
        return this.#events;
    }

    /**
     * @type {number}
     */
    get onlineCount() {
        return this.#playerIds.size;
    }

    /**
     * @type {Iterable<Player>}
     */
    get players() {
        return this.#playerIds.values();
    }

    /**
     * @type {TileManager}
     */
    get tileManager() {
        return this.#tm;
    }

    /**
     * Gets a player by id, undefined if no player with that id
     * @param {number} id The id
     * @return {Player}
     */
    getPlayerById(id) {
        return this.#playerIds.get(id);
    }

    /**
     * Gets a player by name, undefined if no player with that id
     * @param {string} name The name
     * @return {Player}
     */
    getPlayerByName(name) {
        // Note: there's no unique relation between id & name
        for(const p of this.players)
            if(p.name === name)
                return p;

        return null;
    }

    /**
     * Sends a chat message
     * @param {string} msg The message
     */
    sendChat(msg) {
        if(msg.length === 0) return;

        const now = Date.now();

        if(msg.length > CHAT_MAX_LEN) {
            const msg2 = msg.substr(CHAT_MAX_LEN);
            msg = msg.substr(0, CHAT_MAX_LEN);
            setTimeout(() => this.sendChat(msg2), CHAT_DELAY);
        }

        if(now - this.#lastChatTime > CHAT_DELAY) {
            this.#lastChatTime = now;
            this.#socket.emit(Packet.CHAT, msg);
        } else {
            setTimeout(() => this.sendChat(msg), CHAT_DELAY);
        }
    }
}

/**
 * Create fetch promise
 * @private
 * @param {string} fn The filename
 * @return {Promise}
 */
function createFetchPromise(fn) {
    return fetch(DOMAIN + PATH + 'json/' + fn)
            .then(r => r.json());
}

/**
 * Connect to a room
 * @param {string} name The bot name
 * @param {string} apiKey The API key
 * @param {string} roomId The room id
 * @return {Promise}
 */
function connect(name, apiKey, roomId) {
    return new Promise(function(resolve, reject) {
        Promise.all([ createFetchPromise('tiles.json'), createFetchPromise('backgrounds.json') ])
            .then(function([ tiles, backgrounds ]) {
                const tm = new TileManager(tiles, backgrounds);

                // Delay connection so we can register a handler
                const socket = require('socket.io-client')(DOMAIN, {
                    autoConnect: false,
                    parser: require('socket.io-msgpack-parser'),
                    transports: [ 'websocket' ],
                    path: PATH + 'socket.io/',
                    query: { n: name, b: apiKey, r: roomId }
                });

                socket.on('disconnect', () => reject(new Error('Connection failed. Are your room Id and API key correct?')));
                socket.on(Packet.KICK, e => reject(new Error(e)));

                socket.on(Packet.HANDSHAKE, data => {
                    const [ version ] = data;
                    if(version !== PROTOCOL_VERSION) {
                        reject(new Error('This API version is too old. Update the library.'));
                    } else {
                        socket.on(Packet.JOINED, data => {
                            socket.removeAllListeners();
                            resolve(new API(socket, tm, ...data));
                        });
                        socket.emit(Packet.JOIN);
                    }
                });

                socket.open();
            })
            .catch(reject);
    });
}

module.exports = { connect, VanishData, NumberData, PortalData, TextData, Key: require('./key'), Permission: require('./permission'), ...require('./category'), ...require('./direction') };
