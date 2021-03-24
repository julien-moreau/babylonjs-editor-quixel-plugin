import { join } from "path";

import * as React from "react";

import { PBRMaterial, Mesh } from "babylonjs";
import { Editor, IPlugin, MaterialInspector, IPluginConfiguration, Icon } from "babylonjs-editor";

import { Toolbar } from "./toolbar";

import { QuixelMeshInspector } from "./inspectors/lod-inspector";
import { QuixelPBRMaterialInspector } from "./inspectors/pbr-inspector";
import { QuixelPluginPreferencesInspector } from "./inspectors/preferences-inspector";

import { QuixelServer } from "./quixel/server";
import { QuixelListener } from "./quixel/listener";
import { exportPreferences, importPreferences } from "./quixel/preferences";

/**
 * Registers the plugin by returning the IPlugin content.
 * @param editor defines the main reference to the editor.
 */
export const registerEditorPlugin = (editor: Editor, configuration: IPluginConfiguration): IPlugin => {
    QuixelServer.Connect();
    QuixelListener.Init(editor);

    return {
        /**
         * Defines the list of all toolbar elements to add when the plugin has been loaded.
         */
        toolbar: [
            { buttonLabel: "Quixel", buttonIcon: <Icon src={join(configuration.pluginAbsolutePath, "css/icon.png")} style={{ filter: "none" }} />, content: <Toolbar editor={editor} /> }
        ],

        /**
         * Defines the list of all inspector elements.
         */
        inspectors: [
            {
                ctor: QuixelPBRMaterialInspector,
                ctorNames: ["PBRMaterial"],
                title: "Quixel PBR",
                isSupported: (o) => MaterialInspector.IsObjectSupported(o, PBRMaterial) && MaterialInspector.GetMaterialOfObject(o)?.metadata?.isFromQuixel === true,
            },
            {
                ctor: QuixelPluginPreferencesInspector,
                ctorNames: ["QuixelPreferences"],
                title: "Quixel Preferences",
            },
            {
                ctor: QuixelMeshInspector,
                ctorNames: ["Mesh"],
                title: "Quixel Mesh",
                isSupported: (o) => o instanceof Mesh && o.metadata?.isFromQuixel,
            },
        ],

        /**
         * If implemented, should return an object (plain JSON object) that will be saved
         * in the workspace file. This will be typically used to store preferences of the plugin
         * work a given workspace and not globally.
         * If implemented, the preferences will be saved in the .editorworkspace file each time the user
         * saves the project.
         */
        getWorkspacePreferences: () => {
            return {
                ...exportPreferences(),
                availableAssets: QuixelListener.ImportedAssets.map((a) => JSON.stringify(a)),
            };
        },

        /**
         * When the plugin saved preferences (@see .getWorkspacePreferences) this function
         * will be called giving the plain JSON representation of the user's preferences for
         * the current plugin.
         */
        setWorkspacePreferences: (preferences: any) => {
            importPreferences(preferences);
            QuixelListener.ImportedAssets = preferences.availableAssets?.map((a) => JSON.parse(a)) ?? QuixelListener.ImportedAssets;
        },
    };
}
