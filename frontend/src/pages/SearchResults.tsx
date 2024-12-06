import { useNavigate, useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import Page from "@/components/user-defined/page";
import { useEffect, useState } from "react";
import API from "@/api/api";
import { useUserManager } from "@/hooks/use-usermanager";
import Spinner from "@/components/user-defined/spinner";

type SearchResult = {
    id: string;
    title: string;
    description: string;
    score: number;
}

const columns: ColumnDef<SearchResult>[] = [
    {
        accessorKey: 'title',
        header: 'Title',
    },
    {
        accessorKey: 'description',
        header: 'Description',
    },
    {
        accessorKey: 'score',
        header: 'Score',
    }
];

interface ResultsTableProps {
    columns: ColumnDef<SearchResult>[];
    data: SearchResult[];
    query?: string;
}

function ResultsTable({ columns, data, query }: ResultsTableProps) {
    const nav = useNavigate();
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} onClick={() => nav(`/search/${query}/results/${row.original.id}`)}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function SearchResults() {
    const { query } = useParams<{ query: string }>();
    const { user } = useUserManager();
    const regex = new RegExp(query || '', 'i');
    console.log(regex);
    const [loading, setLoading] = useState(true);
    
    const loadResults = async () => {
        setLoading(true);
        const api = new API("https://med4k766h1.execute-api.us-east-1.amazonaws.com/dev");

        const data = {
            "RegEx": regex
        }

        const headers =  {
            "Content-Type": "application/json",
            "X-Authorization": user?.token
        }

        const response = await api.post("/package/byRegEx", data, headers);
        console.log(response);
        setLoading(false);
    }

    useEffect(() => {
        loadResults();
    }, [query]);

    useEffect(() => {}, [loading]);

    return (
        <div>
            <Page>
                <h2 className="bold">Search Results for "{query}"</h2>
                {loading ? <div className="w-full flex flex-1 flex-row justify-center"><Spinner /></div> :  <ResultsTable columns={columns} query={query} data={[]} />}
            </Page>
        </div>
    );
}

export default SearchResults;