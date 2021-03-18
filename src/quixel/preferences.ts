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
    /**
     * Defines wether or not displacement texture should be used as parallax.
     */
    convertDisplacementToParallax: boolean;

    /**
     * Defines wether or not opacity should be merge to albedo's alpha channel.
     */
    mergeOpacityAlphaToAlbedo: boolean;

    /**
     * Defines wether or not 3d plants should be merged together.
     */
    merge3dPlants: boolean;
    /**
     * Defines wether or not the node material (used to simulate wind etc. should be used).
     */
    use3dPlantsNodeMaterial: boolean;
}

export const preferences: IQuixelPreferences = {
    objectScale: 1,
    ambientColor: Color3.Black(),
    
    lodDistance: 20,

    checkCollisions: false,
    checkColiisionsOnLowerLod: false,
    
    automaticallyAddToScene: true,
    useOnlyAlbedoAsHigherQuality: false,
    convertDisplacementToParallax: false,

    mergeOpacityAlphaToAlbedo: true,

    merge3dPlants: true,
    use3dPlantsNodeMaterial: false,
};

/**
 * Exports the preferences to its JSON representation.
 */
export const exportPreferences = () => ({
    objectScale: preferences.objectScale,
    ambientColor: preferences.ambientColor.asArray(),
    
    lodDistance: preferences.lodDistance,

    checkCollisions: preferences.checkCollisions,
    checkColiisionsOnLowerLod: preferences.checkColiisionsOnLowerLod,

    automaticallyAddToScene: preferences.automaticallyAddToScene,
    useOnlyAlbedoAsHigherQuality: preferences.useOnlyAlbedoAsHigherQuality,
    convertDisplacementToParallax: preferences.convertDisplacementToParallax,

    mergeOpacityAlphaToAlbedo: preferences.mergeOpacityAlphaToAlbedo,

    merge3dPlants: preferences.merge3dPlants,
    use3dPlantsNodeMaterial: preferences.use3dPlantsNodeMaterial,
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
    preferences.convertDisplacementToParallax = config.convertDisplacementToParallax ?? false;

    preferences.mergeOpacityAlphaToAlbedo = config.mergeOpacityAlphaToAlbedo ?? true;

    preferences.merge3dPlants = config.merge3dPlants ?? true;
    preferences.use3dPlantsNodeMaterial = config.use3dPlantsNodeMaterial ?? false;
};

export class QuixelPreferences {
    
}
