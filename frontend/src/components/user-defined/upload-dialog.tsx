import React from "react";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { UploadFormUrl } from "./upload-form-url";
import { UploadFormZip } from "./upload-form-zip";

export enum UploadType {
    URL,
    ZIP
}

interface UploadDialogProps {
    title: string;
    type: UploadType
}

const UploadDialog: React.FC<UploadDialogProps> = ({ title, type }) => {
    return (
        <><DialogContent>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {type === UploadType.URL ? <UploadFormUrl /> : <UploadFormZip />}
        </DialogContent></>
    );
};

export default UploadDialog;