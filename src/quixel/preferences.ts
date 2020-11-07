import { Color3 } from "babylonjs";

export interface IQuixelPreferences {
    /**
     * Defines the scale to be applied in case of a 3d asset.
     */
    objectScale: number;
    /**
     * Defines the ambient color to apply on materials by default.
     * By default, all ambient colors are equal to 0,0,0.
     */
    ambientColor: Color3;

    /**
     * Defines wether or not 
     */
    automaticallyAddToScene?: boolean;

    /**
     * Defines wether or not collisions are enabled.
     */
    checkCollisions?: boolean;
    /**
     * Defines wether or not collisions are enabled only on the lower LOD.
     */
    checkColiisionsOnLowerLod?: boolean;

    /**
     * Defines the distance used to separate LODs.
     */
    lodDistance: number;

    /**
     * Defines wether or not only albedo texture should be used as higher quality.
     */
    useOnlyAlbedoAsHigherQuality: boolean;
}

export const preferences: IQuixelPreferences = {
    objectScale: 1,
    ambientColor: Color3.Black(),

    automaticallyAddToScene: true,

    checkCollisions: false,
    checkColiisionsOnLowerLod: false,

    lodDistance: 20,

    useOnlyAlbedoAsHigherQuality: false,
};

/**
 * Exports the preferences to its JSON representation.
 */
export const exportPreferences = () => ({
    objectScale: preferences.objectScale,
    ambientColor: preferences.ambientColor.asArray(),
    
    automaticallyAddToScene: preferences.automaticallyAddToScene,

    checkCollisions: preferences.checkCollisions,
    checkColiisionsOnLowerLod: preferences.checkColiisionsOnLowerLod,

    lodDistance: preferences.lodDistance,
    useOnlyAlbedoAsHigherQuality: preferences.useOnlyAlbedoAsHigherQuality,
});

/**
 * Imports the preferences of the plugin from its JSON representation.
 */
export const importPreferences = (config: any) => {
    if (!config.objectScale) { return; }
    preferences.objectScale = config.objectScale;
    preferences.ambientColor = Color3.FromArray(config.ambientColor);

    preferences.automaticallyAddToScene = config.automaticallyAddToScene ?? true;

    preferences.checkCollisions = config.checkCollisions ?? true;
    preferences.checkColiisionsOnLowerLod = config.checkColiisionsOnLowerLod ?? true;

    preferences.lodDistance = config.lodDistance ?? 20;

    preferences.useOnlyAlbedoAsHigherQuality = config.useOnlyAlbedoAsHigherQuality ?? false;
};

export class QuixelPreferences {
    
}
