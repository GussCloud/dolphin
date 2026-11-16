import { CONTACT_EMAIL, POLICY_UPDATED_ON, type PolicyDocument } from '@/content/policy-document'

// Written from the code (mobile/, cloud/apps/{relay,push,auth}); keep it in step when data flows change.
// TODO(privacy): no automatic pruning found for relay_audit_events, dead push_devices rows or the
// auth feedback table; the "kept until deleted" wording below reflects that.
// TODO(privacy): confirm whether the relay keeps client IP addresses beyond rate-limit windows.
// TODO(privacy): decide whether to name the hosting provider and server location.

export const privacyPolicyEn: PolicyDocument = {
  language: 'en',
  title: 'Privacy Policy',
  description: 'How Dolphin for Agents, the Dolphin mobile companion app, handles your data.',
  updatedLabel: `Last updated: ${POLICY_UPDATED_ON}`,
  intro:
    'This policy covers Dolphin for Agents (Dolphin Mobile), the iOS and Android companion app for the Dolphin desktop app, published by Gustavo Amaral. The app has no user accounts, shows no ads, and contains no analytics, advertising or tracking SDK. We do not sell or share your data for advertising.',
  sections: [
    {
      heading: 'What the app does with your data',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The app is a remote control for Dolphin running on your own computer. What you type, the files and photos you attach, and the voice dictation you record are sent to the desktop you paired with, and the content the app shows (terminals, agent output, diffs, files) comes from that desktop. That desktop is yours: we do not receive this content.'
        },
        {
          kind: 'paragraph',
          text: 'Traffic between the app and your desktop is end-to-end encrypted (Curve25519 key exchange with XSalsa20-Poly1305), both on a direct connection over your local network or VPN and when it passes through our relay.'
        }
      ]
    },
    {
      heading: 'Services we operate',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Three services under dolphin.guss.dev.br can be involved. Each one receives only what is listed here.'
        },
        {
          kind: 'list',
          items: [
            'Relay (relay.dolphin.guss.dev.br). Used when the phone and the desktop are not on the same network. It forwards encrypted traffic it cannot read. To route and authorize connections it stores random identifiers for the desktop and the phone, hashed device credentials with their expiry and revocation state, and a log of pairing and revocation events. Like any server, it sees the IP address you connect from and uses it for rate limiting.',
            'Push notifications (push.dolphin.guss.dev.br), only if you turn notifications on. The app asks Apple (APNs) or Google (Firebase Cloud Messaging) for a device push token and gives it to your paired desktop, which registers it with our push service. The service stores the token, the platform, a random device identifier and a fingerprint of the desktop that registered it. Each notification carries a title and short text written by your desktop (for example, which agent finished or needs input); it passes through our service and Apple or Google, is queued for at most 5 minutes and is deleted within 24 hours. The token is kept until you turn notifications off or unpair, or until Apple or Google reports it invalid.',
            'Connection diagnostics, only when you tap to send them. The report contains the app version, the platform and a recent connection log with tokens and credentials removed. It is stored on our feedback service without your IP address and kept until we delete it.'
          ]
        }
      ]
    },
    {
      heading: 'Permissions',
      blocks: [
        {
          kind: 'list',
          items: [
            'Camera: to scan the pairing QR code shown by the desktop. Camera images are not saved or sent.',
            'Microphone: only while you dictate. The audio is sent to your paired desktop and transcribed there, with a local speech model or, if you set one up on the desktop, the OpenAI transcription service under your own API key.',
            'Photos: only the photos you pick are read, and they are sent to your paired desktop.',
            'Local network: to find and connect to the desktop on your network.',
            'Notifications: to show alerts from your desktop, if you allow them.'
          ]
        }
      ]
    },
    {
      heading: 'Stored on your device',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Pairing credentials are kept in the iOS Keychain or Android Keystore, available only on this device and excluded from backups. The list of paired desktops, your preferences, a short connection log and a crash journal are kept in the app’s private storage. The crash journal never leaves the device unless you share it yourself through the system share sheet. Unpair a desktop from the app or from the desktop to revoke its access; removing the app deletes its storage.'
        }
      ]
    },
    {
      heading: 'Third-party content',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Some images are loaded directly from their source, which sees your IP address: agent icons from Google’s favicon service and avatars from services such as GitHub. Links you open go to your browser. Push delivery is handled by Apple or Google under their own privacy policies.'
        }
      ]
    },
    {
      heading: 'Children',
      blocks: [
        {
          kind: 'paragraph',
          text: 'The app is a developer tool and is not directed to children under 13.'
        }
      ]
    },
    {
      heading: 'Your rights and contact',
      blocks: [
        {
          kind: 'paragraph',
          text: `You can ask us to access or delete data held by our services (for example, a push registration or a diagnostics report) under the Brazilian LGPD, the GDPR or other applicable law. Write to ${CONTACT_EMAIL}. If this policy changes, the new version is published on this page with a new date.`
        }
      ]
    }
  ],
  alternate: { label: 'Ler em português', href: '/pt-br/privacy' }
}

export const privacyPolicyPtBr: PolicyDocument = {
  language: 'pt-BR',
  title: 'Política de Privacidade',
  description:
    'Como o Dolphin for Agents, o app móvel complementar do Dolphin, trata os seus dados.',
  updatedLabel: `Última atualização: ${POLICY_UPDATED_ON}`,
  intro:
    'Esta política cobre o Dolphin for Agents (Dolphin Mobile), o app para iOS e Android que complementa o app de desktop Dolphin, publicado por Gustavo Amaral. O app não tem contas de usuário, não exibe anúncios e não contém nenhum SDK de análise, publicidade ou rastreamento. Não vendemos nem compartilhamos os seus dados para publicidade.',
  sections: [
    {
      heading: 'O que o app faz com os seus dados',
      blocks: [
        {
          kind: 'paragraph',
          text: 'O app é um controle remoto do Dolphin rodando no seu próprio computador. O que você digita, os arquivos e fotos que anexa e o ditado por voz que grava são enviados ao desktop que você pareou, e o conteúdo que o app mostra (terminais, saída dos agentes, diffs, arquivos) vem desse desktop. Esse desktop é seu: nós não recebemos esse conteúdo.'
        },
        {
          kind: 'paragraph',
          text: 'O tráfego entre o app e o seu desktop é criptografado de ponta a ponta (troca de chaves Curve25519 com XSalsa20-Poly1305), tanto na conexão direta pela sua rede local ou VPN quanto quando passa pelo nosso relay.'
        }
      ]
    },
    {
      heading: 'Serviços que operamos',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Três serviços em dolphin.guss.dev.br podem participar. Cada um recebe apenas o que está descrito aqui.'
        },
        {
          kind: 'list',
          items: [
            'Relay (relay.dolphin.guss.dev.br). Usado quando o celular e o desktop não estão na mesma rede. Ele repassa tráfego criptografado que não consegue ler. Para rotear e autorizar conexões, guarda identificadores aleatórios do desktop e do celular, credenciais de dispositivo em forma de hash com validade e estado de revogação, e um registro de eventos de pareamento e revogação. Como qualquer servidor, vê o endereço IP de onde você se conecta e o usa para limitar o volume de requisições.',
            'Notificações push (push.dolphin.guss.dev.br), somente se você ativar as notificações. O app pede à Apple (APNs) ou ao Google (Firebase Cloud Messaging) um token de push do aparelho e o entrega ao desktop pareado, que o registra no nosso serviço de push. O serviço guarda o token, a plataforma, um identificador aleatório do aparelho e uma impressão digital do desktop que fez o registro. Cada notificação leva um título e um texto curto escritos pelo seu desktop (por exemplo, qual agente terminou ou precisa de resposta); ela passa pelo nosso serviço e pela Apple ou pelo Google, fica na fila por no máximo 5 minutos e é apagada em até 24 horas. O token é mantido até você desativar as notificações ou desfazer o pareamento, ou até a Apple ou o Google informarem que ele não é mais válido.',
            'Diagnóstico de conexão, somente quando você toca para enviá-lo. O relatório contém a versão do app, a plataforma e um registro recente de conexões, com tokens e credenciais removidos. Ele é guardado no nosso serviço de feedback sem o seu endereço IP e mantido até ser apagado por nós.'
          ]
        }
      ]
    },
    {
      heading: 'Permissões',
      blocks: [
        {
          kind: 'list',
          items: [
            'Câmera: para ler o QR code de pareamento exibido pelo desktop. As imagens da câmera não são salvas nem enviadas.',
            'Microfone: somente enquanto você dita. O áudio é enviado ao desktop pareado e transcrito lá, por um modelo de fala local ou, se você tiver configurado no desktop, pelo serviço de transcrição da OpenAI com a sua própria chave de API.',
            'Fotos: somente as fotos que você escolhe são lidas, e elas são enviadas ao desktop pareado.',
            'Rede local: para encontrar o desktop na sua rede e se conectar a ele.',
            'Notificações: para mostrar alertas do seu desktop, se você permitir.'
          ]
        }
      ]
    },
    {
      heading: 'Guardado no seu aparelho',
      blocks: [
        {
          kind: 'paragraph',
          text: 'As credenciais de pareamento ficam no Keychain do iOS ou no Keystore do Android, disponíveis só neste aparelho e fora dos backups. A lista de desktops pareados, as suas preferências, um registro curto de conexões e um diário de falhas ficam no armazenamento privado do app. O diário de falhas nunca sai do aparelho, a não ser que você mesmo o compartilhe pela folha de compartilhamento do sistema. Desfaça o pareamento no app ou no desktop para revogar o acesso; remover o app apaga o armazenamento dele.'
        }
      ]
    },
    {
      heading: 'Conteúdo de terceiros',
      blocks: [
        {
          kind: 'paragraph',
          text: 'Algumas imagens são carregadas diretamente da origem, que vê o seu endereço IP: ícones de agentes pelo serviço de favicons do Google e avatares de serviços como o GitHub. Links que você abre vão para o seu navegador. A entrega de push é feita pela Apple ou pelo Google, sob as políticas de privacidade deles.'
        }
      ]
    },
    {
      heading: 'Crianças',
      blocks: [
        {
          kind: 'paragraph',
          text: 'O app é uma ferramenta para desenvolvedores e não é destinado a menores de 13 anos.'
        }
      ]
    },
    {
      heading: 'Seus direitos e contato',
      blocks: [
        {
          kind: 'paragraph',
          text: `Você pode pedir acesso ou exclusão dos dados guardados pelos nossos serviços (por exemplo, um registro de push ou um relatório de diagnóstico), nos termos da LGPD, do GDPR ou de outra lei aplicável. Escreva para ${CONTACT_EMAIL}. Se esta política mudar, a nova versão é publicada nesta página com uma nova data.`
        }
      ]
    }
  ],
  alternate: { label: 'Read in English', href: '/privacy' }
}
