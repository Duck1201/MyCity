import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dockerIngressRules } from '../security/firewall-policy.mjs';

it.each(['generated', 'deployed-source'])('limita tráfego Docker externo às portas e protocolos aprovados: %s', (source) => {
    const rules = source === 'generated' ? dockerIngressRules('ens5') : readFileSync('infra/firewall/docker-ingress.rules', 'utf8');
    const ports = [...rules.matchAll(/-p (tcp|udp) -m conntrack --ctdir ORIGINAL --ctorigdstport ([\d:]+)/g)].map((match) => `${match[1]}:${match[2]}`);
    expect(ports).toEqual(['tcp:22', 'tcp:80', 'tcp:443', 'tcp:8080', 'tcp:9000', 'tcp:40000:40100', 'udp:51820', 'udp:40000:40100']);
    expect(rules).toContain('--ctstate ESTABLISHED,RELATED -j RETURN');
    expect(rules.trim().endsWith('-A MYCITY-INGRESS -j DROP\nCOMMIT')).toBe(true);
    expect(rules).not.toContain(':DOCKER-USER');
    expect(rules.split('\n').filter((line) => line && !line.startsWith('#'))).toEqual(['*filter', ':MYCITY-INGRESS - [0:0]', '-A MYCITY-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN', '-A MYCITY-INGRESS -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 22 -j RETURN', '-A MYCITY-INGRESS -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 80 -j RETURN', '-A MYCITY-INGRESS -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 443 -j RETURN', '-A MYCITY-INGRESS -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 8080 -j RETURN', '-A MYCITY-INGRESS -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 9000 -j RETURN', '-A MYCITY-INGRESS -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport 40000:40100 -j RETURN', '-A MYCITY-INGRESS -p udp -m conntrack --ctdir ORIGINAL --ctorigdstport 51820 -j RETURN', '-A MYCITY-INGRESS -p udp -m conntrack --ctdir ORIGINAL --ctorigdstport 40000:40100 -j RETURN', '-A MYCITY-INGRESS -j DROP', 'COMMIT']);
});

it('rejeita nomes de interface que alterariam a sintaxe do firewall', () => {
    expect(() => dockerIngressRules('ens5\nCOMMIT')).toThrow();
});
