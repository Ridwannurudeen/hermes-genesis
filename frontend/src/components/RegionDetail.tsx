import { X, MapPin, Thermometer, Gem, Landmark } from 'lucide-react';
import type { Region, Character } from '../types';

interface Props {
  region: Region;
  factionMap: Record<string, { name: string; color: string }>;
  characters: Character[];
  onClose: () => void;
}

export default function RegionDetail({
  region,
  factionMap,
  characters,
  onClose,
}: Props) {
  const controller = region.controlled_by
    ? factionMap[region.controlled_by]
    : null;

  return (
    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-100">{region.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2 py-0.5 bg-white/[0.06] rounded text-xs text-gray-400 capitalize flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {region.type}
              </span>
              <span className="px-2 py-0.5 bg-white/[0.06] rounded text-xs text-gray-400 capitalize flex items-center gap-1">
                <Thermometer className="w-3 h-3" />
                {region.climate}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Controller */}
        {controller && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
              Controlled by
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: controller.color }}
              />
              <span className="text-sm text-gray-200 font-medium">
                {controller.name}
              </span>
            </div>
          </div>
        )}

        {/* Resources */}
        {region.resources.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1">
              <Gem className="w-3 h-3" /> Resources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {region.resources.map((r, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-white/[0.06] rounded-full text-xs text-gray-300 capitalize"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Points of Interest */}
        {region.points_of_interest.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1">
              <Landmark className="w-3 h-3" /> Points of Interest
            </p>
            <div className="space-y-2">
              {region.points_of_interest.map((poi, i) => (
                <div key={i} className="bg-white/[0.04] rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-gray-200 font-medium">
                      {poi.name}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {poi.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{poi.significance}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Characters Present */}
        {characters.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
              Characters Present ({characters.length})
            </p>
            <div className="space-y-1.5">
              {characters.map((c) => {
                const faction = factionMap[c.faction_id];
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 py-1 px-2 rounded bg-white/[0.03]"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: faction?.color || '#6b7280',
                      }}
                    />
                    <span
                      className={`text-sm ${
                        c.alive ? 'text-gray-200' : 'text-gray-500 line-through'
                      }`}
                    >
                      {c.name}
                    </span>
                    <span className="text-xs text-gray-600 ml-auto capitalize">
                      {c.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        {region.description && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
              Description
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              {region.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
