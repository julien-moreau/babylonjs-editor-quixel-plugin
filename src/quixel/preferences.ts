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
}

export const preferences: IQuixelPreferences = {
    objectScale: 1,
    ambientColor: Color3.Black(),

    automaticallyAddToScene: true,
};

/**
 * Exports the preferences to its JSON representation.
 */
export const exportPreferences = () => ({
    objectScale: preferences.objectScale,
    ambientColor: preferences.ambientColor.asArray(),
    
    automaticallyAddToScene: preferences.automaticallyAddToScene,
});

/**
 * Imports the preferences of the plugin from its JSON representation.
 */
export const importPreferences = (config: any) => {
    if (!config.objectScale) { return; }
    preferences.objectScale = config.objectScale;
    preferences.ambientColor = Color3.FromArray(config.ambientColor);

    preferences.automaticallyAddToScene = config.automaticallyAddToScene ?? true;
};

export class QuixelPreferences {
    
}
