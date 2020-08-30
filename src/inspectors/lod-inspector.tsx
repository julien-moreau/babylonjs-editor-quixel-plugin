import { AbstractInspector } from "babylonjs-editor";
import { Mesh } from "babylonjs";

export class QuixelMeshInspector extends AbstractInspector<Mesh> {
    /**
     * Called on the component did moubnt.
     * @override
     */
    public onUpdate(): void {
        this._addLod();
    }

    /**
     * Adds the common editable properties.
     * @override
     */
    private _addLod(): void {
        const lod = this.tool!.addFolder("Level Of Details");
        lod.open();
        lod.add(this.selectedObject.metadata, "lodDistance").min(this.selectedObject.getLODLevels().length).name("Distance").onChange((r) => {
            const lods = this.selectedObject.getLODLevels().slice();
            lods.forEach((lod) => this.selectedObject.removeLODLevel(lod.mesh!));

            lods.reverse().forEach((lod, index) => {
                this.selectedObject.addLODLevel(r * (index + 1), lod.mesh);
            });
        });
    }
}
