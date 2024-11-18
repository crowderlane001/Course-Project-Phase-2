import React from "react";
import Landing from "@/components/user-defined/landing";
import Page from "@/components/user-defined/page";
import FeaturesList from "@/components/user-defined/features-list";
import { Separator } from "@/components/ui/separator";

const Home: React.FC = () => {
  return (
    <Page>
      <Landing />
      <Separator />
      <FeaturesList />
    </Page>
  );
};

export default Home;
