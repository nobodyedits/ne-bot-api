'use strict';

/**
 * @private
 */
const Packet = {
    RESPAWN:                0,
    DIE:                    1,
    JOINED:                 2,
    FOREGROUND:             3,
    FOREGROUND_INFO:        4,
    FOREGROUND_DATA:        5,
    FOREGROUND_DATA_INFO:   6,
    JOIN:                   7,
    LEAVE:                  8,
    MOVE:                   9,
    JUMP:                   10,
    CHAT:                   11,
    ACTIVATEKEY:            12,
    KEY_STATUS:             13,
    CROWN:                  15,
    GOD:                    16,
    REMOVECOIN:             18,
    ADDCOIN:                19,
    SAVEROOM:               22,
    RESET:                  23,
    BACKGROUND:             24,
    BACKGROUND_INFO:        25,
    KICK:                   26,
    PLAYCOUNT:              27,
    OWNERINFO:              29,
    UPDATEINFO:             30,
    CLEARROOM:              31,
    LOADROOM:               32,
    RESETPLAYERS:           33,
    NODRAG:                 37,
    UPDATE_PERMS:           40,
    TP_TO_PLAYER:           43,
    HANDSHAKE:              45,
};

module.exports = Packet;
