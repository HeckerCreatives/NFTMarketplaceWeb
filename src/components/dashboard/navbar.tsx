import { ChevronRight, ShoppingBag } from "lucide-react";
import Link from "next/link";



export function Navbar () {

    const navlist = [
        {
            name: "Marketplace",
            link: "/",
        },
        {
            name: "Inventory",
            link: "/inventory",
        },
        // {
        //     name: "Create NFT",
        //     link: "/create",
        // },
        {
            name: "My Profile",
            link: "/profile",
        },
    ]
    return (
        <nav className=" w-full max-w-[1440px] flex items-center justify-between h-[70px]">
        <div className=" flex items-center gap-2 text-zinc-300">
            {navlist.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-zinc-300">
                    <Link href={item.link}>
                    <p className=" text-sm font-medium">{item.name}</p>                    
                    </Link>
                </div>
            ))}
    
        </div>
        </nav>
    )
}