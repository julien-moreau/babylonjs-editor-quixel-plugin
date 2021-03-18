import { pathExists } from "fs-extra";

import * as React from "react";
import {
    Classes, ButtonGroup, Button, Divider, Popover, Tag, Intent,
    Overlay, Spinner, InputGroup, Position, Switch, FormGroup,
    NonIdealState,
} from "@blueprintjs/core";

import { AbstractEditorPlugin, IEditorPluginProps } from "babylonjs-editor";
import { IStringDictionary, Nullable } from "babylonjs-editor/shared/types";

import { Observer, Vector3 } from "babylonjs";

import { QuixelListener } from "../quixel/listener";
import { IQuixelExport } from "../quixel/types";

export const title = "Quixel Assets";

export interface IQuixelAssetBrowserPluginState {
    /**
     * Defines wether or not the asset browser is loading an asset.
     */
    loading: boolean;
    /**
     * Defines the list of all available assets.
     */
    assets: IQuixelExport[];

    /**
     * Defines the current filter used to search assets.
     */
    filter: string;

    /**
     * Defines wether or not surfaces should be shown.
     */
    showSurfaces: boolean;
    /**
     * Defines wether or not 3d objects should be shown.
     */
    show3dObjects: boolean;
    /**
     * Defines wether or not 3d plants should be shown.
     */
    show3dPlants: boolean;
    /**
     * Defines wether or not atlases should be shown.
     */
    showAtlases: boolean;
}

export default class PreviewPlugin extends AbstractEditorPlugin<IQuixelAssetBrowserPluginState> {
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
            borderWidth: "1px",
            borderColor: "black",
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
    private _dropListener: Nullable<(ev: DragEvent) => void> = null;

    /**
     * Constructor.
     * @param props defines the component's props.
     */
    public constructor(props: IEditorPluginProps) {
        super(props);

        this.state = {
            loading: false,
            assets: [],
            filter: "",

            showSurfaces: true,
            show3dObjects: true,
            show3dPlants: true,
            showAtlases: true,
        };
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        const filters = (
            <FormGroup label="Types" style={{ padding: "15px" }}>
                <Switch checked={this.state.showSurfaces} label="Surfaces" onChange={(v) => this.setState({ showSurfaces: (v.target as HTMLInputElement).checked })} />
                <Switch checked={this.state.show3dObjects} label="3d Objects" onChange={(v) => this.setState({ show3dObjects: (v.target as HTMLInputElement).checked })} />
                <Switch checked={this.state.show3dPlants} label="3d Plants" onChange={(v) => this.setState({ show3dPlants: (v.target as HTMLInputElement).checked })} />
                <Switch checked={this.state.showAtlases} label="Atlases" onChange={(v) => this.setState({ showAtlases: (v.target as HTMLInputElement).checked })} />
            </FormGroup>
        );

        return (
            <>
                <div className={Classes.FILL} key="materials-toolbar" style={{ width: "100%", height: "30px", backgroundColor: "#333333", borderRadius: "10px", marginTop: "5px" }}>
                    <ButtonGroup>
                        <Button key="refresh-folder" icon="refresh" small={true} onClick={() => this.refresh()} />
                        <Popover content={filters} position={Position.BOTTOM_LEFT}>
                            <Button icon="filter" rightIcon="caret-down" small={true} text="Types"/>
                        </Popover>
                        <Divider />
                        <InputGroup value={this.state.filter} style={{ borderRadius: "15px" }} placeholder="Search..." leftIcon="search" onChange={(e) => this.setState({ filter: e.target.value })} />
                    </ButtonGroup>
                </div>

                {this._getAssetsThumbnails()}
                
                <Overlay isOpen={this.state.loading} usePortal={false} hasBackdrop={true} enforceFocus={true}>
                    <div style={{ width: "100px", height: "100px", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
                        <Spinner size={100} />
                    </div>
                </Overlay>
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
    public async refresh(): Promise<void> {
        this.setState({ loading: true });
        const assets: IQuixelExport[] = [];

        for (const a of QuixelListener.ImportedAssets) {
            const exists = await pathExists(a.path);
            if (exists) {
                assets.push(a);
            }
        }

        this.setState({ loading: false, assets });
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
     * Returns the available assets by applying the filter.
     */
    private _getFilteredAssets(): IQuixelExport[] {
        let assets = this.state.assets.filter((a) => a.name.toLowerCase().indexOf(this.state.filter.toLowerCase()) !== -1);
        if (!this.state.showSurfaces) {
            assets = assets.filter((a) => a.type !== "surface");
        }
        if (!this.state.show3dObjects) {
            assets = assets.filter((a) => a.type !== "3d");
        }
        if (!this.state.show3dPlants) {
            assets = assets.filter((a) => a.type !== "3dplant");
        }
        if (!this.state.showAtlases) {
            assets = assets.filter((a) => a.type !== "atlas");
        }

        return assets;
    }

    /**
     * Returns the component used to draw the assets thumbnails.
     */
    private _getAssetsThumbnails(): React.ReactNode {
        const assets = this._getFilteredAssets();

        if (!assets.length) {
            return (
                <NonIdealState
                    icon="search"
                    title="No Assets Here"
                />
            );
        }

        return (
            <div style={{ width: "100%", height: "calc(100% - 40px)", overflow: "auto" }}>
                {assets.map((a) => this._getThumbnail(a))}
            </div>
        );
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
                        onDragStart={() => this._handleDragStart(json)}
                        onDragEnd={() => this._handleDragEnd()}
                        onMouseEnter={(ev) => (ev.target as HTMLImageElement).style.borderStyle = "double"}
                        onMouseLeave={(ev) => (ev.target as HTMLImageElement).style.borderStyle = "none"}
                    ></img>
                </Popover>
                <small style={PreviewPlugin._ThumbnailStyles.title}>{json.name}</small>
            </div>
        );
    }

    /**
     * Called on the user starts dragging the asset.
     */
    private _handleDragStart(json: IQuixelExport): void {
        this.editor.engine!.getRenderingCanvas()?.addEventListener("drop", this._dropListener = (ev) => {
            const pick = this.editor.scene!.pick(ev.offsetX, ev.offsetY);
            this._handleAssetDoubleClick(json, pick?.pickedPoint);
        });
    }

    /**
     * Called on the user stopped dragging the asset.
     */
    private _handleDragEnd(): void {
        if (this._dropListener) {
            this.editor.engine!.getRenderingCanvas()?.removeEventListener("drop", this._dropListener);
            this._dropListener = null;
        }
    }

    /**
     * Called on the user double clicks an asset.
     */
    private async _handleAssetDoubleClick(json: IQuixelExport, atPosition?: Nullable<Vector3>): Promise<void> {
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

        this.setState({ loading: true });
        
        if (this.editor.getPreferences().developerMode) {
            this.editor.revealPanel("console");
        }
        await instance.importAssets([json], true, atPosition);

        this.setState({ loading: false });
    }
}
