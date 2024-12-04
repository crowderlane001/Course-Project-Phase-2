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
    file: z.instanceof(File).refine((file) => file.type === "application/zip", {
        message: "File must be a ZIP archive",
    }),
})

export function UploadFormZip() {

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            name: "",
            file: undefined,
        },
    });

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        const { name, file } = data;
        const base64File = await convertFileToBase64(file);
        const formData = new FormData();
        formData.append("Name", name);
        formData.append("Content", base64File);

        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");
        try {
            const response = await api.post("/package", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            console.log(response);
        } catch (error) {
            console.error("Error uploading package: ", error);
        }
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
                    name="file"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>File</FormLabel>
                            <FormControl>
                                <Input className="text-base" type="file" onChange={(e) => field.onChange(e.target.files?.[0])} />
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