import * as React from "react";
import { Menu, MenuItem } from "@blueprintjs/core";

import { Editor } from "babylonjs-editor";
import { QuixelServer } from "./quixel/server";

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
                <MenuItem text="Restart..." icon="exchange" onClick={() => this._handleRestartServer()} />
            </Menu>
        );
    }

    /**
     * Called on the user wants to show the editor's version.
     */
    private _handleRestartServer(): void {
        QuixelServer.Restart();
    }
}
