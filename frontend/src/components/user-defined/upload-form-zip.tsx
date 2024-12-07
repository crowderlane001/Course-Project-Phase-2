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
import { useEffect, useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"
import Spinner from "./spinner"
import { DialogClose } from "@radix-ui/react-dialog"
import { useUserManager } from "@/hooks/use-usermanager"

const FormSchema = z.object({
    file: z.instanceof(File).refine((file) => file.type === "application/zip", {
        message: "File must be a ZIP archive",
    }),
})

export function UploadFormZip() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const { user } = useUserManager();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
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
        setIsSubmitting(true);
        const { file } = data;
        const base64File: string = await convertFileToBase64(file);
        const base64String = base64File.replace(/^data:application\/zip;base64,/, "");

        const formData: object = {
            "Content": base64String,
            "debloat": false,
            "JSProgram": "",
        };

        console.log(formData);

        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

        const headers = {
            "Content-Type": "application/json",
            "Authorization": user?.token
        }

        api.post("/package", formData, headers)
            .then(() => {
                toast({
                    title: "Success",
                    description: "Package uploaded successfully",
                })
                setIsSubmitting(false);
                if (closeRef.current) {
                    closeRef.current.click();
                }
            })
            .catch(() => {
                toast({
                    title: "Error",
                    description: "An error occurred while uploading the package",
                })
                setIsSubmitting(false);
            });
    }

    useEffect(() => {}, [isSubmitting]);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
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
                {
                    isSubmitting ? <Spinner /> : <Button type="submit">Submit</Button>
                }
                <DialogClose ref={closeRef} className="hidden" />
            </form>
        </Form>
    )
}