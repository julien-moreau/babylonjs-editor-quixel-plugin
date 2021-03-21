import * as React from "react";

import {
    AbstractInspector, InspectorSection, InspectorNumber, InspectorBoolean,
    InspectorColor, InspectorColorPicker,
} from "babylonjs-editor";

import { QuixelPreferences, preferences } from "../quixel/preferences";

export class QuixelPluginPreferencesInspector extends AbstractInspector<QuixelPreferences, {}> {
    /**
     * Renders the content of the inspector.
     */
    public renderContent(): React.ReactNode {
        return (
            <>
                <InspectorSection title="Common">
                    <InspectorBoolean object={preferences} property="automaticallyAddToScene" label="Add in scene instead of assets" />
                    <InspectorBoolean object={preferences} property="useOnlyAlbedoAsHigherQuality" label="Use Only Albedo As Higher Quality" />
                    <InspectorBoolean object={preferences} property="convertDisplacementToParallax" label="Convert Displacement To Parallax" />
                </InspectorSection>

                <InspectorSection title="Mesh">
                    <InspectorNumber object={preferences} property="objectScale" label="Object Scale" step={0.01} />
                    <InspectorColor object={preferences} property="ambientColor" label="Ambient Color" step={0.01} />
                    <InspectorColorPicker object={preferences} property="ambientColor" label="Hex Color" />
                </InspectorSection>

                <InspectorSection title="Collisions">
                    <InspectorBoolean object={preferences} property="checkCollisions" label="Check Collisions" />
                    <InspectorBoolean object={preferences} property="checkColiisionsOnLowerLod" label="Check Collisions On Lower LOD" />
                </InspectorSection>

                <InspectorSection title="LOD">
                    <InspectorNumber object={preferences} property="lodDistance" label="LOD Distance" min={5} step={0.01} />
                </InspectorSection>
            </>
        );
    }
}
