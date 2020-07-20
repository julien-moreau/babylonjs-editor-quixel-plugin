import { Inspector, MaterialInspector, MaterialAssets } from "babylonjs-editor";
import { PBRMaterial, Texture } from "babylonjs";
import { GUI } from "dat.gui";

export class QuixelPBRMaterialInspector extends MaterialInspector<PBRMaterial> {
    /**
     * Registers the preferences inspector.
     */
    public static Register(): void {
        Inspector.registerObjectInspector({
            ctor: QuixelPBRMaterialInspector,
            ctorNames: ["PBRMaterial"],
            title: "Quixel PBR",
            isSupported: (o) => MaterialInspector.IsObjectSupported(o, PBRMaterial) && o.metadata?.isFromQuixel === true,
        });
    }

    private _mapUVScale: number = 0;

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
        uvs.add(this, "_mapUVScale").min(0).step(0.1).name("UV Uniform Scale").onChange(() => {
            textures.forEach((texture) => {
                texture.uScale = this._mapUVScale;
                texture.vScale = this._mapUVScale;
            });
        });
    }
}
