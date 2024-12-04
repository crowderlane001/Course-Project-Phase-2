import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import Page from "@/components/user-defined/page";
import { Separator } from "@/components/ui/separator";
import React, { useState } from "react";
import PackageList from "@/components/user-defined/package-list";
import UploadDialog, { UploadType } from "@/components/user-defined/upload-dialog";
import { Dialog } from "@radix-ui/react-dialog";
import { UploadIcon } from "lucide-react";

interface ModalState {
  isOpen: boolean;
}

const Packages: React.FC = () => {

  const PackageBar: React.FC = () => {
    const [modalType, setModalType] = useState<UploadType>(UploadType.URL);

    const [modal, setModalState] = useState<ModalState>({
      isOpen: false
    });

    const openModel = (modalType: UploadType) => {
      setModalType(modalType);
      setModalState({ isOpen: true });
    }

    const closeModel = () => {
      setModalState({ isOpen: false });
    }

    return (
      <Dialog open={modal.isOpen} onOpenChange={closeModel}>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger><span className="flex flex-row gap-1 items-center"><UploadIcon size={'1rem'} /> Upload package</span></MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => openModel(UploadType.URL)}>
                <span>With URL</span>
              </MenubarItem>
              <MenubarItem onClick={() => openModel(UploadType.ZIP)}>
                With ZIP
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <UploadDialog title="Upload package" type={modalType} />
      </Dialog>
    );
  }

  return (
    <Page>

      <h1>Packages</h1>
      <PackageBar />
      <Separator />
      <PackageList />

    </Page>
  );
};

export default Packages;
