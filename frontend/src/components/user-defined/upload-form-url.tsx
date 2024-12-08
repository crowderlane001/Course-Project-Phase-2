"use client"

import { useEffect, useRef, useState } from 'react';
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
import { useToast } from "@/hooks/use-toast"
import Spinner from "@/components/user-defined/spinner";
import { DialogClose } from '@radix-ui/react-dialog';
import { useUserManager } from '@/hooks/use-usermanager';

const npmOrGithubUrlRegex = /^(https:\/\/(www\.)?(npmjs\.com|github\.com)\/.+)$/;

const FormSchema = z.object({
    name: z.string().nonempty(),
    url: z.string().url().refine((url) => npmOrGithubUrlRegex.test(url), {
        message: "URL must be a valid npm or GitHub URL",
    }),
})

export function UploadFormUrl() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useUserManager();
    const closeRef = useRef<HTMLButtonElement>(null);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            name: "",
            url: "",
        },
    })

    function onSubmit(data: z.infer<typeof FormSchema>) {
        setIsSubmitting(true);
        const { url, name } = data;
        const packageUpload = {
            "Name": name,
            "URL": url,
            "debloat": false,
            "JSProgram": ""
        }

        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

        const headers = {
            "Content-Type": "application/json",
            "X-Authorization": user?.token
        };

        api.post("/package", packageUpload, headers)
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
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input className="text-base" type="text" placeholder="Enter package name" {...field} />
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
                {
                    isSubmitting ? <Spinner /> : <Button type="submit">Submit</Button>
                }
                <DialogClose ref={closeRef} className="hidden" />
            </form>
        </Form>
    )
}
