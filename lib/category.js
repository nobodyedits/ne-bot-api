'use strict';

/**
 * @public
 */
const Category = {
    OTHER: "none",
    PLATFORMER: "platformer",
    ART: "art",
    BOSS: "boss",
    MINIGAME: "minigame",
    RACE: "race"
};

class InvalidCategoryError extends Error {
    /**
     * @private
     */
    constructor() {
        super('Invalid category');
        Error.captureStackTrace(this, InvalidCategoryError);
    }
}

module.exports = { Category: Object.freeze(Category), InvalidCategoryError };
