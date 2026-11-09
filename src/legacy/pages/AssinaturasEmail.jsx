import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Mail, ShieldCheck } from 'lucide-react';
import { useServers } from '../../stores/workspace';
import { useInternalBack } from '../utils/internalNavigation';
import styles from '../styles/AssinaturasEmail.module.css';

export default function AssinaturasEmail() {
  const navigate = useNavigate();
  const voltarPaginaInterna = useInternalBack('/chat');
  const [erro, setErro] = useState('');
  const [abrindo, setAbrindo] = useState(false);

  // No app Windows o gerador abre numa janela do Workspace (já com o login do chat, para listar os membros).
  // Fora do app (navegador), abre a página no servidor do chat.
  const abrirGerador = async () => {
    setErro('');
    setAbrindo(true);
    try {
      const token = sessionStorage.getItem('token') || '';
      if (window.desktop?.assinaturasAbrir) {
        await window.desktop.assinaturasAbrir(token);
      } else {
        const origem = useServers.getState().config.chat || window.location.origin;
        window.open(`${origem}/email-signatures/index.html`, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setErro(String(e?.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'Não foi possível abrir o gerador.');
    } finally {
      setAbrindo(false);
    }
  };

  useEffect(() => {
    if (!sessionStorage.getItem('token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={voltarPaginaInterna}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <section className={styles.hero}>
          <span>
            <Mail size={16} />
            Modelos corporativos
          </span>
          <h1>Assinaturas de e-mail</h1>
          <p>
            Modelos editáveis em HTML para Acessa Net, Projecta Empreendimentos e Dias Gestão, prontos para copiar e colar no Gmail, Outlook ou webmail.
          </p>
        </section>

        <section className={styles.infoBox}>
          <ShieldCheck size={24} />
          <p>
            Abra o gerador, escolha a empresa, selecione um membro do chat ou preencha os dados manualmente, envie uma foto profissional e copie a assinatura pronta.
          </p>
        </section>

        <section className={styles.createPanel}>
          <div>
            <strong>Criar assinatura</strong>
            <p>Use um único gerador para Acessa Net, Projecta Empreendimentos e Dias Gestão.</p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={abrindo}
            onClick={abrirGerador}
          >
            {abrindo ? 'Abrindo…' : 'Criar assinatura'}
            <ExternalLink size={16} />
          </button>
        </section>
        {erro ? <p role="alert" style={{ color: '#b42318', margin: '0 0 8px' }}>{erro}</p> : null}

        <section className={styles.readmeBox}>
          <div>
            <strong>Como usar a assinatura pronta</strong>
            <p><b>Gmail:</b> Configurações, Ver todas as configurações, Geral, Assinatura, cole e salve.</p>
            <p><b>Outlook:</b> Arquivo, Opções, Email, Assinaturas, cole no campo e salve.</p>
            <p>Cole com Ctrl + V (não como texto simples) para manter imagens e links. Revise cargo, telefone e foto antes de copiar.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
