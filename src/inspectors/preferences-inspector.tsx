import { Inspector, AbstractInspector } from "babylonjs-editor";

import { QuixelPreferences, preferences } from "../quixel/preferences";

export class QuixelPluginPreferencesInspector extends AbstractInspector<QuixelPreferences> {
    /**
     * Registers the preferences inspector.
     */
    public static Register(): void {
        Inspector.registerObjectInspector({
            ctor: QuixelPluginPreferencesInspector,
            ctorNames: ["QuixelPreferences"],
            title: "Quixel Preferences",
        });
    }

    /**
     * Called on the component did moubnt.
     * @override
     */
    public onUpdate(): void {
        const mesh = this.tool!.addFolder("Mesh");
        mesh.open();
        mesh.add(preferences, "objectScale").min(0).step(0.001).name("Object Scale");

        const material = this.tool!.addFolder("Material");
        material.open();
        this.addColor(material, "Ambient Color", preferences, "ambientColor");
    }
}