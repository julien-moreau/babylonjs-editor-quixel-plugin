import { join } from "path";

import * as React from "react";
import { Menu, MenuItem, MenuDivider } from "@blueprintjs/core";

import { Editor } from "babylonjs-editor";

import { QuixelServer } from "./quixel/server";
import { QuixelPreferences } from "./quixel/preferences";

export interface IToolbarProps {
    /**
     * Defines the reference to the editor.
     */
    editor: Editor;
}

export class Toolbar extends React.Component<IToolbarProps> {
    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <Menu>
                <MenuItem text="Preferences..." icon="settings" onClick={() => this._handleShowPreferences()} />
                <MenuItem text="Restart..." icon="exchange" onClick={() => this._handleRestartServer()} />
                <MenuDivider />
                <MenuItem text="Browse assets..." onClick={() => this._handleBrowseAssets()} />
            </Menu>
        );
    }

    /**
     * Called on the user wants to show the editor's version.
     */
    private _handleRestartServer(): void {
        this.props.editor.console.logInfo("Quixel Bridge: restarting server.")
        QuixelServer.Restart();
        this.props.editor.console.logInfo("Quixel Bridge: restarted server.")
    }

    /**
     * Called on the user wants to edit the preferences of the plugin.
     */
    private _handleShowPreferences(): void {
        this.props.editor.inspector.setSelectedObject(new QuixelPreferences());
    }

    /**
     * Called on the user wants to browse the available assets.
     */
    private _handleBrowseAssets(): void {
        this.props.editor.addPluginFromPath(join(__dirname, "plugins/viewer"));
    }
}
