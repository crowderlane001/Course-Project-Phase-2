import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import Page from "@/components/user-defined/page";
import { Separator } from "@/components/ui/separator";
import React, { useEffect, useState } from "react";
import PackageList from "@/components/user-defined/package-list";
import UploadDialog, { UploadType } from "@/components/user-defined/upload-dialog";
import { Dialog } from "@radix-ui/react-dialog";
import { UploadIcon } from "lucide-react";
import Package from "@/models/package";
import { usePackageManager } from "@/hooks/use-packagemanager";
import API from "@/api/api";
import { useUserManager } from "@/hooks/use-usermanager";

interface ModalState {
  isOpen: boolean;
}

const Packages: React.FC = () => {

  const PackageBar: React.FC = () => {
    const { setPackages } = usePackageManager();
    const [modalType, setModalType] = useState<UploadType>(UploadType.URL);
    const { user } = useUserManager();

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

    const getPackages = async () => {
      const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

      const headers = {
        "Content-Type": "application/json",
        "X-Authorization": user?.token
      }

      api.post("/packages", [{ Name: "*" }], headers)
        .then((response: any) => {
          const packages = response.map((pkg: any) => new Package(pkg.ID, pkg.Name, pkg.Version));
          setPackages(packages);
        }).catch((error) => {
          console.error("Error fetching data: ", error);
        });
    }

    useEffect(() => {
      getPackages();
    }, []);



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
