import * as React from "react";
import { Classes, ButtonGroup, Button, Divider, Popover, Tag, Intent } from "@blueprintjs/core";

import { AbstractEditorPlugin } from "babylonjs-editor";
import { IStringDictionary, Nullable } from "babylonjs-editor/shared/types";

import { Observer, Vector3 } from "babylonjs";

import { QuixelListener } from "../quixel/listener";
import { IQuixelExport } from "../quixel/types";

export const title = "Quixel Assets";

export default class PreviewPlugin extends AbstractEditorPlugin<{ }> {
    private static _ThumbnailStyles: IStringDictionary<React.CSSProperties> = {
        main: {
            position: "relative",
            width: "100px",
            height: "100px",
            float: "left",
            margin: "10px",
            borderRadius: "10px",
        },
        image: {
            width: "100px",
            height: "100px",
            borderRadius: "15px",
            objectFit: "contain",
        },
        title: {
            float: "left",
            width: "100px",
            left: "50%",
            top: "8px",
            transform: "translate(-50%, -50%)",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
            position: "relative",
        },
    };

    private _importedAssetObserver: Nullable<Observer<IQuixelExport>> = null;

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <>
                <div className={Classes.FILL} key="materials-toolbar" style={{ width: "100%", height: "25px", backgroundColor: "#333333", borderRadius: "10px", marginTop: "5px" }}>
                    <ButtonGroup>
                        <Button key="refresh-folder" icon="refresh" small={true} onClick={() => this.refresh()} />
                        <Divider />
                    </ButtonGroup>
                </div>
                {QuixelListener.ImportedAssets.map((a) => this._getThumbnail(a))}
            </>
        );
    }

    /**
     * Called on the plugin is ready.
     */
    public onReady(): void {
        if (this.editor.isInitialized) {
            this._registerEvents();
        } else {
            this.editor.editorInitializedObservable.addOnce(() => this._registerEvents());
        }
    }

    /**
     * Called on the plugin is closed.
     */
    public onClose(): void {
        QuixelListener.GetInstance().onAssetImportedObservable.remove(this._importedAssetObserver);
    }

    /**
     * Refreshes the current list of available assets.
     */
    public refresh(): void {
        this.forceUpdate();
    }

    /**
     * Registers all events for the assets browser.
     */
    private _registerEvents(): void {
        this._importedAssetObserver = QuixelListener.GetInstance().onAssetImportedObservable.add(() => {
            this.refresh();
        });

        this.refresh();
    }

    /**
     * Returns the thumbnail for the given quixel exported asset.
     */
    private _getThumbnail(json: IQuixelExport): React.ReactNode {
        const popoverContent = (
            <div style={{ padding: "15px" }}>
                <ul>
                    <b>Meta:</b><br />
                    {json.meta.map((m) => (
                        <li key={`${m.key}-li`}>
                            <Tag key={`${m.key}-tag`} intent={Intent.PRIMARY} fill={true}>{`${m.name}: ${m.value}`}</Tag>
                        </li>
                    ))}
                </ul>
                <Divider />
                <img
                    src={json.previewImage}
                    style={{ ...PreviewPlugin._ThumbnailStyles.images, width: "300px", height: "300px", objectFit: "contain" }}
                ></img>
            </div>
        );

        return (
            <div key={json.id} style={PreviewPlugin._ThumbnailStyles.main}>
                <Popover content={popoverContent} usePortal={true} interactionKind="click" autoFocus={true} enforceFocus={true} canEscapeKeyClose={true} boundary="window">
                    <img
                        src={json.previewImage}
                        style={PreviewPlugin._ThumbnailStyles.image}
                        onDoubleClick={() => this._handleAssetDoubleClick(json)}
                    ></img>
                </Popover>
                <small style={PreviewPlugin._ThumbnailStyles.title}>{json.name}</small>
            </div>
        );
    }

    /**
     * Called on the user double clicks an asset.
     */
    private async _handleAssetDoubleClick(json: IQuixelExport, atPosition?: Vector3): Promise<void> {
        const instance = QuixelListener.GetInstance();

        if (!atPosition) {
            const pick = this.editor.scene!.pick(
                this.editor.engine!.getRenderWidth() * 0.5,
                this.editor.engine!.getRenderHeight() * 0.5,
            );

            atPosition = pick?.pickedPoint ?? Vector3.Zero();

            if (pick?.pickedPoint) {
                const camera = this.editor.scene!.activeCamera!;

                const distance = Vector3.Distance(camera.position, pick.pickedPoint);
                if (distance > camera.maxZ * 0.25) {
                    atPosition.scaleInPlace(0.25);
                }
            }
        }

        instance.importAssets([json], atPosition);
    }
}
