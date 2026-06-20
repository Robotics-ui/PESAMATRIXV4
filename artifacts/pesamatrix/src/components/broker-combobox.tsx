import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BROKERS, getServersForBroker, type BrokerServer } from "@/lib/broker-data";

interface BrokerComboboxProps {
  value: string;
  onChange: (broker: string) => void;
  onServerReset?: () => void;
}

export function BrokerCombobox({ value, onChange, onServerReset }: BrokerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = BROKERS.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const handleSelect = (name: string) => {
    const changed = name !== value;
    onChange(name);
    if (changed && onServerReset) onServerReset();
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between bg-background border-input text-sm font-normal h-9"
        onClick={() => setOpen(!open)}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "Select broker..."}
        </span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground mr-2" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search broker..."
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No broker found</div>
            ) : (
              filtered.map((broker) => (
                <button
                  key={broker.name}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    value === broker.name && "bg-accent/50"
                  )}
                  onClick={() => handleSelect(broker.name)}
                >
                  <Check
                    className={cn("h-3.5 w-3.5 shrink-0", value === broker.name ? "opacity-100 text-blue-400" : "opacity-0")}
                  />
                  {broker.name}
                </button>
              ))
            )}
          </div>
          {search && filtered.length === 0 && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left border-t border-border hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleSelect(search)}
            >
              <Check className="h-3.5 w-3.5 opacity-0 shrink-0" />
              <span className="text-muted-foreground">Use</span>
              <span className="font-medium text-foreground">"{search}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ServerComboboxProps {
  value: string;
  onChange: (server: string) => void;
  broker: string;
}

export function ServerCombobox({ value, onChange, broker }: ServerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const brokerServers = getServersForBroker(broker);
  const realServers = brokerServers.filter((s) => s.type === "real");
  const demoServers = brokerServers.filter((s) => s.type === "demo");
  const hasBrokerServers = brokerServers.length > 0;

  const filterServer = (s: BrokerServer) =>
    s.name.toLowerCase().includes(search.toLowerCase());

  const filteredReal = realServers.filter(filterServer);
  const filteredDemo = demoServers.filter(filterServer);
  const hasResults = filteredReal.length + filteredDemo.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between bg-background border-input text-sm font-normal h-9"
        onClick={() => setOpen(!open)}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || (hasBrokerServers ? "Select server..." : "Type server name...")}
        </span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground mr-2" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={hasBrokerServers ? "Search server..." : "Type server name..."}
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {hasBrokerServers ? (
              <>
                {filteredReal.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400 bg-green-500/5">
                      Real / Live
                    </div>
                    {filteredReal.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer",
                          value === s.name && "bg-accent/50"
                        )}
                        onClick={() => handleSelect(s.name)}
                      >
                        <Check className={cn("h-3.5 w-3.5 shrink-0", value === s.name ? "opacity-100 text-blue-400" : "opacity-0")} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {filteredDemo.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400 bg-yellow-500/5">
                      Demo
                    </div>
                    {filteredDemo.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer",
                          value === s.name && "bg-accent/50"
                        )}
                        onClick={() => handleSelect(s.name)}
                      >
                        <Check className={cn("h-3.5 w-3.5 shrink-0", value === s.name ? "opacity-100 text-blue-400" : "opacity-0")} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {!hasResults && (
                  <div className="py-4 text-center text-sm text-muted-foreground">No server found</div>
                )}
              </>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground px-3">
                Select a broker first to see its servers, or type any server name.
              </div>
            )}
          </div>
          {search && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground",
                (hasResults || hasBrokerServers) && "border-t border-border"
              )}
              onClick={() => handleSelect(search)}
            >
              <Check className="h-3.5 w-3.5 opacity-0 shrink-0" />
              <span className="text-muted-foreground">Use</span>
              <span className="font-medium text-foreground">"{search}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
