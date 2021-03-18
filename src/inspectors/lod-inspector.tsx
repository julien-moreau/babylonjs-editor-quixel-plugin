import * as React from "react";

import { Mesh } from "babylonjs";
import { AbstractInspector, InspectorSection, InspectorNumber } from "babylonjs-editor";

export class QuixelMeshInspector extends AbstractInspector<Mesh, {}> {
    /**
     * Renders the content of the inspector.
     */
    public renderContent(): React.ReactNode {
        return (
            <InspectorSection title="LODs">
                <InspectorNumber object={this.selectedObject.metadata} property="lodDistance" label="LOD Distance" min={0} step={0.01} onChange={(r) => {
                    const lods = this.selectedObject.getLODLevels().slice();
                    lods.forEach((lod) => this.selectedObject.removeLODLevel(lod.mesh!));
        
                    lods.reverse().forEach((lod, index) => {
                        this.selectedObject.addLODLevel(r * (index + 1), lod.mesh);
                    });
                }} />
            </InspectorSection>
        );
    }
}
