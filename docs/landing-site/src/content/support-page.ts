import { CONTACT_EMAIL, POLICY_UPDATED_ON, type PolicyDocument } from '@/content/policy-document'
import { GITHUB_REPO_URL, ISSUES_URL } from '@/lib/site-links'

// Pairing and troubleshooting steps mirror mobile/src/i18n/catalogs/{app-routes,diagnostics}.
// TODO(support): the app posts diagnostics to https://dolphin.guss.dev.br/v1/feedback, but Caddy
// routes /v1/feedback only on api.dolphin.guss.dev.br, so sending a report fails today.

export const supportPageEn: PolicyDocument = {
  language: 'en',
  title: 'Support',
  description: 'Help for Dolphin for Agents, the Dolphin mobile companion app.',
  updatedLabel: `Last updated: ${POLICY_UPDATED_ON}`,
  intro:
    'Dolphin for Agents (Dolphin Mobile) is the companion app for the Dolphin desktop app. It lets you watch your coding agents, read their terminals and send follow-ups from your phone. It needs Dolphin running on a computer you pair it with; on its own it does nothing.',
  sections: [
    {
      heading: 'Pair your phone',
      blocks: [
        {
          kind: 'list',
          items: [
            'Install and open Dolphin on your computer.',
            'In the desktop app, go to Settings → Mobile.',
            'In the mobile app, scan the QR code shown there. If the camera is not available, copy the code shown under the QR on your computer and paste it in the app.'
          ]
        },
        {
          kind: 'paragraph',
          text: 'On the same network (or Tailscale) the phone connects to the desktop directly. Away from it, the connection goes through the Dolphin relay, which requires the desktop to be signed in to a Dolphin cloud account.'
        }
      ]
    },
    {
      heading: 'Common problems',
      blocks: [
        {
          kind: 'list',
          items: [
            'The phone cannot find the desktop: Dolphin must be open on the computer. Try restarting it, since the companion server starts with the app. After a desktop update you may need to pair again with the QR code.',
            'Different networks: for a direct connection both devices must be on the same local network, unless you use Tailscale. Try reconnecting Wi-Fi on both.',
            'Firewall: allow Dolphin in macOS System Settings → Network → Firewall, or in Windows Defender Firewall for private networks. On Linux, allow port 6768. Corporate and school networks may block local connections; try a personal hotspot.',
            'VPN: VPNs other than Tailscale can route local traffic away. Turn the VPN off or enable split tunneling or “Allow LAN”.',
            'Timeouts: check the Wi-Fi signal, go back to the host list and tap your desktop to retry, and restart both apps if it keeps happening.',
            'No notifications: turn notifications on in the app, check that the system settings allow Dolphin notifications, and that Focus or Do Not Disturb is off.'
          ]
        },
        {
          kind: 'paragraph',
          text: 'The app has a troubleshooting screen with connection checks. From there you can send a connection diagnostics report, with credentials removed, to help us investigate.'
        }
      ]
    },
    {
      heading: 'Contact',
      blocks: [
        {
          kind: 'paragraph',
          text: `Report bugs and request features on GitHub. For anything else, including privacy requests, write to ${CONTACT_EMAIL}.`
        },
        {
          kind: 'links',
          items: [
            { label: 'GitHub issues', href: ISSUES_URL },
            { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
            { label: 'Source code', href: GITHUB_REPO_URL },
            { label: 'Privacy policy', href: '/privacy' }
          ]
        }
      ]
    }
  ],
  alternate: { label: 'Ler em português', href: '/pt-br/support' }
}

export const supportPagePtBr: PolicyDocument = {
  language: 'pt-BR',
  title: 'Suporte',
  description: 'Ajuda para o Dolphin for Agents, o app móvel complementar do Dolphin.',
  updatedLabel: `Última atualização: ${POLICY_UPDATED_ON}`,
  intro:
    'O Dolphin for Agents (Dolphin Mobile) é o app complementar do app de desktop Dolphin. Com ele você acompanha os seus agentes de código, lê os terminais e envia respostas pelo celular. Ele precisa do Dolphin rodando num computador pareado; sozinho, não faz nada.',
  sections: [
    {
      heading: 'Parear o celular',
      blocks: [
        {
          kind: 'list',
          items: [
            'Instale e abra o Dolphin no seu computador.',
            'No app de desktop, vá em Configurações → Mobile.',
            'No app móvel, escaneie o QR code exibido ali. Se a câmera não estiver disponível, copie o código mostrado abaixo do QR no computador e cole no app.'
          ]
        },
        {
          kind: 'paragraph',
          text: 'Na mesma rede (ou pelo Tailscale), o celular se conecta direto ao desktop. Fora dela, a conexão passa pelo relay do Dolphin, o que exige que o desktop esteja conectado a uma conta na nuvem do Dolphin.'
        }
      ]
    },
    {
      heading: 'Problemas comuns',
      blocks: [
        {
          kind: 'list',
          items: [
            'O celular não encontra o desktop: o Dolphin precisa estar aberto no computador. Tente reiniciá-lo, pois o servidor do app móvel sobe junto com ele. Depois de uma atualização do desktop, pode ser preciso parear de novo pelo QR code.',
            'Redes diferentes: para a conexão direta, os dois aparelhos precisam estar na mesma rede local, a não ser que você use o Tailscale. Tente reconectar o Wi-Fi nos dois.',
            'Firewall: libere o Dolphin em Ajustes do Sistema → Rede → Firewall no macOS, ou no Firewall do Windows Defender para redes privadas. No Linux, libere a porta 6768. Redes corporativas e de escolas podem bloquear conexões locais; tente o roteador do celular.',
            'VPN: VPNs que não sejam o Tailscale podem desviar o tráfego local. Desligue a VPN ou ative o split tunneling ou “Permitir LAN”.',
            'Tempo esgotado: verifique o sinal do Wi-Fi, volte à lista de computadores e toque no seu desktop para tentar de novo, e reinicie os dois apps se continuar acontecendo.',
            'Sem notificações: ative as notificações no app e confira se os ajustes do sistema permitem notificações do Dolphin e se o Foco ou o Não Perturbe está desligado.'
          ]
        },
        {
          kind: 'paragraph',
          text: 'O app tem uma tela de solução de problemas com verificações de conexão. Dali você pode enviar um relatório de diagnóstico de conexão, sem credenciais, para nos ajudar a investigar.'
        }
      ]
    },
    {
      heading: 'Contato',
      blocks: [
        {
          kind: 'paragraph',
          text: `Relate bugs e peça recursos no GitHub. Para qualquer outro assunto, inclusive pedidos de privacidade, escreva para ${CONTACT_EMAIL}.`
        },
        {
          kind: 'links',
          items: [
            { label: 'Issues no GitHub', href: ISSUES_URL },
            { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
            { label: 'Código-fonte', href: GITHUB_REPO_URL },
            { label: 'Política de privacidade', href: '/pt-br/privacy' }
          ]
        }
      ]
    }
  ],
  alternate: { label: 'Read in English', href: '/support' }
}
