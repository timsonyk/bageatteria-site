"use client";

import { useState, useEffect, useRef } from "react";
import { StoreLocation } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { getStoreLocations } from "@/lib/api";

const STORAGE_KEY = "selected_store_location";

interface LocationSelectorProps {
  onLocationChange: (locationId: number | null) => void;
}

export function LocationSelector({ onLocationChange }: LocationSelectorProps) {
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<StoreLocation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load locations and check for saved selection
  useEffect(() => {
    async function loadLocations() {
      try {
        const data = await getStoreLocations();
        setLocations(data);

        // Check for saved location
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const saved = data.find((l) => l.id === parseInt(savedId));
          if (saved) {
            setSelectedLocation(saved);
            onLocationChange(saved.id);
            return;
          }
        }

        // No saved location - show initial modal
        setIsInitialModalOpen(true);
      } catch (err) {
        console.error("Failed to load locations:", err);
      }
    }
    loadLocations();
  }, [onLocationChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (location: StoreLocation) => {
    setSelectedLocation(location);
    localStorage.setItem(STORAGE_KEY, String(location.id));
    onLocationChange(location.id);
    setIsOpen(false);
    setIsInitialModalOpen(false);
  };

  const LocationList = () => (
    <div className="py-1">
      {locations.map((location) => (
        <button
          key={location.id}
          onClick={() => handleSelect(location)}
          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
            selectedLocation?.id === location.id ? "bg-gray-50" : ""
          }`}
        >
          <div className="font-medium text-black">{location.name}</div>
          <div className="text-sm text-gray-500">{location.address_text}</div>
          {location.working_hours && (
            <div className="text-xs text-gray-400 mt-1">{location.working_hours}</div>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Dropdown Container */}
      <div className="relative" ref={dropdownRef}>
        {/* Location Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-300 rounded-full transition-colors ${
            isOpen ? "bg-gray-50" : "hover:bg-gray-50"
          }`}
        >
          <svg
            width="16"
            height="16"
            className="-mr-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-black">
            {selectedLocation ? selectedLocation.name : "Выберите точку"}
          </span>
          <svg
            width="12"
            height="12"
            className={`-ml-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Выберите точку</span>
            </div>
            <LocationList />
          </div>
        )}
      </div>

      {/* Initial Selection Modal (can't be closed without selection) */}
      <BottomSheet
        isOpen={isInitialModalOpen && !selectedLocation}
        onClose={() => {}}
        title="Выберите точку"
      >
        <div className="px-4 py-2 text-sm text-gray-500 text-center">
          Для просмотра меню выберите точку
        </div>
        <LocationList />
      </BottomSheet>
    </>
  );
}
