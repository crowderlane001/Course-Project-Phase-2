"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import API from "@/api/api";

const FormSchema = z.object({
    name: z.string(),
    url: z.string(),
})

export function UploadFormUrl() {

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            name: "",
            url: "",
        },
    })

    function onSubmit(data: z.infer<typeof FormSchema>) {
        const { name, url } = data;
        const packageUpload = {
            "Name": name,
            "URL": url,
        }

        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");
        api.post("/package", packageUpload)
            .then((response) => {
                console.log(response);
            })
            .catch((error) => {
                console.error("Error uploading package: ", error);
            });

    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Package Name</FormLabel>
                            <FormControl>
                                <Input className="text-base" placeholder="Enter package name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                                <Input className="text-base" type="url" placeholder="Enter package URL" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit">Submit</Button>
            </form>
        </Form>
    )
}
