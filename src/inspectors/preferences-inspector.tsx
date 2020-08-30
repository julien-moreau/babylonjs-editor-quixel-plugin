import { AbstractInspector } from "babylonjs-editor";

import { QuixelPreferences, preferences } from "../quixel/preferences";

export class QuixelPluginPreferencesInspector extends AbstractInspector<QuixelPreferences> {
    /**
     * Called on the component did moubnt.
     * @override
     */
    public onUpdate(): void {
        this._addCommon();
        this._addMesh();
        this._addCollisions();
        this._addLod();
    }

    /**
     * Adds all the common editable properties.
     */
    private _addCommon(): void {
        const common = this.tool!.addFolder("Common");
        common.open();

        common.add(preferences, "automaticallyAddToScene").name("Add in scene instead of assets.");
    }

    /**
     * Adds all the meshes editable properties.
     */
    private _addMesh(): void {
        const mesh = this.tool!.addFolder("Mesh");
        mesh.open();
        mesh.add(preferences, "objectScale").min(0).step(0.001).name("Object Scale");

        const material = this.tool!.addFolder("Material");
        material.open();
        this.addColor(material, "Ambient Color", preferences, "ambientColor");
    }

    /**
     * Adds all the collisions editable properties.
     */
    private _addCollisions(): void {
        const collisions = this.tool!.addFolder("Collisions");
        collisions.open();

        collisions.add(preferences, "checkCollisions").name("Check Collisions");
        collisions.add(preferences, "checkColiisionsOnLowerLod").name("Check Collisions On Lower LOD");
    }

    /**
     * Adds all the LOD editable properties
     */
    private _addLod(): void {
        const lods = this.tool!.addFolder("Level Of Detils");
        lods.open();
        lods.add(preferences, "lodDistance").min(5).step(0.01).name("LOD Distance");
    }
}
