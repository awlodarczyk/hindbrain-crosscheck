import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Separator } from "./separator";
import { Slider } from "./slider";
import { Switch } from "./switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Textarea } from "./textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

describe("form primitives", () => {
  it("renders input and textarea with token classes", () => {
    render(
      <>
        <Input placeholder="in" />
        <Textarea placeholder="ta" />
        <Separator />
        <Separator orientation="vertical" />
      </>,
    );
    expect(screen.getByPlaceholderText("in")).toHaveClass("h-8", "rounded-control");
    expect(screen.getByPlaceholderText("ta")).toHaveClass("bg-bg-card");
  });

  it("toggles the switch", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="s" onCheckedChange={onCheckedChange} />);
    await userEvent.setup().click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("renders a slider thumb per value", () => {
    render(<Slider defaultValue={[10, 20]} />);
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });
});

describe("tabs", () => {
  it("switches content", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">one</TabsContent>
        <TabsContent value="b">two</TabsContent>
      </Tabs>,
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByText("two")).toBeVisible();
  });
});

describe("overlays", () => {
  it("opens a dialog", async () => {
    render(
      <Dialog>
        <DialogTrigger>open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <DialogFooter>foot</DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    await userEvent.setup().click(screen.getByText("open"));
    expect(screen.getByRole("dialog")).toHaveClass("rounded-dialog");
  });

  it("opens a dropdown menu", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>L</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.setup().click(screen.getByText("menu"));
    expect(await screen.findByRole("menuitem", { name: "Item" })).toBeInTheDocument();
  });

  it("shows a tooltip when open", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent>hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getAllByText("hint").length).toBeGreaterThan(0);
  });

  it("renders select content when open", () => {
    render(
      <Select open>
        <SelectTrigger>
          <SelectValue placeholder="pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group</SelectLabel>
            <SelectItem value="a">Apple</SelectItem>
            <SelectSeparator />
            <SelectItem value="b">Banana</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
  });
});

describe("command", () => {
  it("filters items", async () => {
    render(
      <Command>
        <CommandInput placeholder="search" />
        <CommandList>
          <CommandEmpty>none</CommandEmpty>
          <CommandGroup heading="G">
            <CommandItem>Alpha</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem>Beta</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    await userEvent.setup().type(screen.getByPlaceholderText("search"), "zzz");
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
