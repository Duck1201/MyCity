import { Text as SvgText } from 'react-native-svg';
import cartography from './vicosa-basemap.json';
import type { PrototypeMapProps } from './prototype-map';

type Region = PrototypeMapProps['region']['current'];
export const extent = cartography.bounds as [number, number, number, number];
const shapes = new Map<string, string[]>();
for (const line of cartography.lines) {
    const points = line.points;
    const closed = points[0]![0] === points.at(-1)![0] && points[0]![1] === points.at(-1)![1];
    const kind = line.kind === 'water' && closed ? 'lake' : line.kind;
    const path = points.map(([x, y], index) => (index ? 'L' : 'M') + x + ',' + -y!).join('') + (closed ? 'Z' : '');
    if (!shapes.has(kind)) shapes.set(kind, []);
    shapes.get(kind)!.push(path);
}
const geometry = Object.fromEntries([...shapes].map(([kind, paths]) => [kind, paths.join('')]));
const namedWays = cartography.lines.filter((line) => line.name && ['major', 'street', 'water'].includes(line.kind));

function streetLabels(region: Region, width: number, height: number, markers: { x: number; y: number }[]) {
    const labels: { name: string; x: number; y: number; angle: number }[] = [];
    const used = new Set<string>();
    const west = region.longitude - region.longitudeDelta / 2;
    const north = region.latitude + region.latitudeDelta / 2;
    for (const line of namedWays) {
        const name = line.name!;
        if (used.has(name)) continue;
        const short = name.replace(/^Avenida /, 'Av. ').replace(/^Rua /, 'R. ');
        // Place text along a visible segment, reserving room for controls and markers.
        let best: { x: number; y: number; angle: number; length: number } | undefined;
        for (let i = 1; i < line.points.length; i++) {
            const [ax, ay] = line.points[i - 1]!,
                [bx, by] = line.points[i]!;
            const x = (((ax! + bx!) / 2 - west) * width) / region.longitudeDelta,
                y = ((north - (ay! + by!) / 2) * height) / region.latitudeDelta;
            if (x < 50 || x > width - 56 || y < 18 || y > height - 24) continue;
            if (markers.some((p) => Math.abs(p.x * width - x) < 38 && Math.abs(p.y * height - y) < 25)) continue;
            if (labels.some((p) => Math.abs(p.x - x) < 85 && Math.abs(p.y - y) < 36)) continue;
            const dx = ((bx! - ax!) * width) / region.longitudeDelta,
                dy = ((ay! - by!) * height) / region.latitudeDelta,
                length = Math.hypot(dx, dy);
            if (length < 13 || (best && length <= best.length)) continue;
            let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (angle > 90) angle -= 180;
            else if (angle < -90) angle += 180;
            best = { x, y, angle, length };
        }
        if (best) {
            used.add(name);
            labels.push({ name: short, ...best });
        }
        if (labels.length >= 6) break;
    }
    return labels;
}

export function OfflineStreets({ region, width, height, markers }: { region: Region; width: number; height: number; markers: { x: number; y: number }[] }) {
    const view = [region.longitude - region.longitudeDelta / 2, -region.latitude - region.latitudeDelta / 2, region.longitudeDelta, region.latitudeDelta].join(' ');
    const labels = streetLabels(region, width, height, markers);
    return (
        <svg style={{ paintOrder: 'stroke' }} aria-hidden="true" focusable="false" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <svg width={width} height={height} viewBox={view} preserveAspectRatio="none" fill="none" strokeLinejoin="round" strokeLinecap="round">
                <path d={geometry.park} fill="#c4dbc1" />
                <path d={geometry.lake} fill="#a8cfdd" />
                <path d={geometry.water} stroke="#a1c9d7" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                <path d={geometry.path} stroke="#c0bcb0" strokeWidth={1.3} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                <path d={geometry.street} stroke="#d2ccbd" strokeWidth={5.6} vectorEffect="non-scaling-stroke" />
                <path d={geometry.major} stroke="#ceb995" strokeWidth={8.4} vectorEffect="non-scaling-stroke" />
                <path d={geometry.street} stroke="#fffdf8" strokeWidth={3.8} vectorEffect="non-scaling-stroke" />
                <path d={geometry.major} stroke="#fff0c7" strokeWidth={6} vectorEffect="non-scaling-stroke" />
                <path d={geometry.rail} stroke="#aaa8a2" strokeWidth={1.25} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            </svg>
            {labels.map(({ name, x, y, angle }) => (
                <SvgText key={name} x={x} y={y} transform={`rotate(${angle} ${x} ${y})`} textAnchor="middle" fill="#4c564e" stroke="#fbf9f0" strokeWidth={2.8} fontSize={10} fontFamily="Nunito-SemiBold, sans-serif">
                    {name}
                </SvgText>
            ))}
        </svg>
    );
}
