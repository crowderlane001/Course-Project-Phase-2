//This file contains code for a list of features.

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

function FeaturesList() {
    return (
        <div className="flex flex-col gap-5 pb-32">
            <h2 className="font-bold">What features do we have?</h2>
            <Accordion type="single" collapsible>
                <AccordionItem className="flex flex-col gap-5" value="item-1">
                    <AccordionTrigger>Package scoring</AccordionTrigger>
                    <AccordionContent>
                        We assign scores by special metrics the company needs to consider!
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem className="flex flex-col gap-5" value="item-2">
                    <AccordionTrigger>Check size cost</AccordionTrigger>
                    <AccordionContent>
                        Check both direct and indirect size costs of a package.
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem className="flex flex-col gap-5" value="item-3">
                    <AccordionTrigger>Search for packages</AccordionTrigger>
                    <AccordionContent>
                        Search a package by name and README contents.
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

export default FeaturesList