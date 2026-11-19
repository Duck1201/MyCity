export function dockerIngressRules(networkInterface) {
    if (!/^[a-zA-Z0-9_.:-]{1,15}$/.test(networkInterface)) throw new Error('Interface inválida.');
    const lines = [`# External interface: ${networkInterface}`, '*filter', ':MYCITY-INGRESS - [0:0]', '-A MYCITY-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN'];
    for (const [protocol, ports] of [
        ['tcp', ['22', '80', '443', '8080', '9000', '40000:40100']],
        ['udp', ['51820', '40000:40100']],
    ]) {
        for (const port of ports) lines.push(`-A MYCITY-INGRESS -p ${protocol} -m conntrack --ctdir ORIGINAL --ctorigdstport ${port} -j RETURN`);
    }
    return [...lines, '-A MYCITY-INGRESS -j DROP', 'COMMIT', ''].join('\n');
}
