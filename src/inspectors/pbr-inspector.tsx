import { MaterialInspector, MaterialAssets } from "babylonjs-editor";
import { PBRMaterial, Texture } from "babylonjs";
import { GUI } from "dat.gui";

export class QuixelPBRMaterialInspector extends MaterialInspector<PBRMaterial> {
    private _mapUVScale: number = 0;
    private _mapUScale: number = 0;
    private _mapVScale: number = 0;

    /**
     * Called on a controller finished changes.
     * @override
     */
    public onControllerFinishChange(): void {
        super.onControllerFinishChange();
        this.editor.assets.refresh(MaterialAssets, this.material);
    }

    /**
     * Adds the common editable properties.
     * @override
     */
    protected addCommon(): GUI {
        const common = this.tool!.addFolder("Common");
        
        this.addUVScale();

        return common;
    }

    /**
     * Adds the UV scaling editable properties.
     */
    protected addUVScale(): void {
        const textures = this.material.getActiveTextures().filter((texture) => texture instanceof Texture) as Texture[];
        this._mapUVScale = textures[0]?.uScale ?? 1;

        const uvs = this.tool!.addFolder("UV");
        uvs.open();
        uvs.add(this, "_mapUVScale").min(0).step(0.01).name("UV Uniform Scale").onChange(() => {
            textures.forEach((texture) => {
                texture.uScale = this._mapUVScale;
                texture.vScale = this._mapUVScale;
            });

            this.refreshDisplay();
        });

        // U and V scales
        const uv = uvs.addFolder("UV");
        uv.open();

        this._mapUScale = textures[0]?.uScale ?? 1;
        this._mapVScale = textures[0]?.vScale ?? 1;

        uv.add(this, "_mapUScale").min(0).step(0.01).name("U Scale").onChange(() => {
            textures.forEach((texture) => texture.uScale = this._mapUScale);
        });
        uv.add(this, "_mapVScale").min(0).step(0.01).name("U Scale").onChange(() => {
            textures.forEach((texture) => texture.vScale = this._mapVScale);
        });
    }
}
