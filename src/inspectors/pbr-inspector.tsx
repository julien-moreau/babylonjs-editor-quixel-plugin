import * as React from "react";

import { PBRMaterial, Texture } from "babylonjs";
import {
    MaterialInspector, IObjectInspectorProps, InspectorSection, InspectorNumber,
    InspectorNotifier,  IMaterialInspectorState,
} from "babylonjs-editor";

export interface IQuixelPBRMaterialInspectorState extends IMaterialInspectorState {
    /**
     * Defines the value of both U and V scale for the textures.
     */
    mapUVScale: number;
    /**
     * Defines the value of the U scale for the textures.
     */
    mapUScale: number;
    /**
     * Defines the value of the V scale for the textures.
     */
    mapVScale: number;
}

export class QuixelPBRMaterialInspector extends MaterialInspector<PBRMaterial, IQuixelPBRMaterialInspectorState> {
    /**
     * Constructor.
     * @param props defines the component's props.
     */
    public constructor(props: IObjectInspectorProps) {
        super(props);

        const textures = this._getMaterialTextures();

        this.state = {
            mapUVScale: textures[0]?.uScale ?? 1,
            mapUScale: textures[0]?.uScale ?? 1,
            mapVScale: textures[0]?.vScale ?? 1,
        };
    }

    /**
     * Renders the content of the inspector.
     */
    public renderContent(): React.ReactNode {
        const textures = this._getMaterialTextures();

        return (
            <>
                <InspectorSection title="Textures">
                    <InspectorNumber object={this.state} property="mapUVScale" label="UV Uniform Scale" onChange={(v) => {
                        textures.forEach((t) => { t.uScale = v; t.vScale = v; });
                    }} onFinishChange={(v) => {
                        this.setState({ mapUScale: v, mapVScale: v }, () => {
                            InspectorNotifier.NotifyChange(this.state, { caller: this });
                        });
                    }} />

                    <InspectorNumber object={this.state} property="mapUScale" label="U Scale" onChange={(v) => {
                        textures.forEach((t) => t.uScale = v);
                    }} />

                    <InspectorNumber object={this.state} property="mapVScale" label="V Scale" onChange={(v) => {
                        textures.forEach((t) => t.vScale = v);
                    }} />
                </InspectorSection>
            </>
        );
    }

    /**
     * Returns the list of all textures assigned to the material.
     */
    private _getMaterialTextures(): Texture[] {
        return this.material.getActiveTextures().filter((texture) => texture instanceof Texture) as Texture[];
    }
}
