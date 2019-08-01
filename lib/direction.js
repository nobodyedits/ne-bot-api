'use strict';

/**
 * @public
 */
const Direction = {
    LEFT:  0,
    UP:    1,
    RIGHT: 2,
    DOWN:  3,
};

class InvalidDirectionError extends Error {
    /**
     * @private
     */
    constructor() {
        super('Invalid direction');
        Error.captureStackTrace(this, InvalidDirectionError);
    }
}

module.exports = { Direction: Object.freeze(Direction), InvalidDirectionError };
