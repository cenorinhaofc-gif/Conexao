import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
} from "react";

import type {
  User as SupabaseUser,
} from "@supabase/supabase-js";

import "./App.css";
import { supabase } from "./lib/supabase";

/* =========================================================
   TIPOS
========================================================= */

type Profile = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  status: string;
};

type Server = {
  id: string;
  owner_id: string;
  name: string;
  icon_url: string | null;
  created_at: string;
};

type Channel = {
  id: string;
  server_id: string;
  name: string;
  description: string;
  created_at: string;
};

type DatabaseMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ChatMessage = DatabaseMessage & {
  author: string;
  avatar_url: string | null;
};

type Member = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  status: string;
  role: string;
};

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function createShortName(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function normalizeChannelName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

/* =========================================================
   COMPRIMIR IMAGEM
========================================================= */

function compressImage(
  file: File,
  maxSize = 512,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        let width = image.width;
        let height = image.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(
              (height * maxSize) / width
            );

            width = maxSize;
          } else {
            width = Math.round(
              (width * maxSize) / height
            );

            height = maxSize;
          }
        }

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
          canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "Não foi possível processar a imagem."
            )
          );

          return;
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        resolve(
          canvas.toDataURL(
            "image/webp",
            quality
          )
        );
      };

      image.onerror = () => {
        reject(
          new Error(
            "Não foi possível abrir a imagem."
          )
        );
      };

      image.src = reader.result as string;
    };

    reader.onerror = () => {
      reject(
        new Error(
          "Não foi possível ler a imagem."
        )
      );
    };

    reader.readAsDataURL(file);
  });
}

/* =========================================================
   APP
========================================================= */

function App() {
  const profileFileInputRef =
    useRef<HTMLInputElement>(null);

  const serverFileInputRef =
    useRef<HTMLInputElement>(null);

  /* =======================================================
     AUTENTICAÇÃO
  ======================================================= */

  const [
    authUser,
    setAuthUser,
  ] = useState<SupabaseUser | null>(null);

  const [
    currentUser,
    setCurrentUser,
  ] = useState<Profile | null>(null);

  const [
    authChecking,
    setAuthChecking,
  ] = useState(true);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(false);

  const [
    authMode,
    setAuthMode,
  ] = useState<"login" | "register">(
    "login"
  );

  const [
    authName,
    setAuthName,
  ] = useState("");

  const [
    authEmail,
    setAuthEmail,
  ] = useState("");

  const [
    authPassword,
    setAuthPassword,
  ] = useState("");

  const [
    authConfirmPassword,
    setAuthConfirmPassword,
  ] = useState("");

  const [
    authError,
    setAuthError,
  ] = useState("");

  const [
    authSuccess,
    setAuthSuccess,
  ] = useState("");

  const [
    lastSignupEmail,
    setLastSignupEmail,
  ] = useState("");

  const [
    resendLoading,
    setResendLoading,
  ] = useState(false);

  /* =======================================================
     DADOS DO APP
  ======================================================= */

  const [
    appLoading,
    setAppLoading,
  ] = useState(false);

  const [
    servers,
    setServers,
  ] = useState<Server[]>([]);

  const [
    currentServerId,
    setCurrentServerId,
  ] = useState<string | null>(null);

  const [
    channels,
    setChannels,
  ] = useState<Channel[]>([]);

  const [
    currentChannelId,
    setCurrentChannelId,
  ] = useState<string | null>(null);

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([]);

  const [
    members,
    setMembers,
  ] = useState<Member[]>([]);

  const [
    message,
    setMessage,
  ] = useState("");

  /* =======================================================
     PERFIL
  ======================================================= */

  const [
    showProfile,
    setShowProfile,
  ] = useState(false);

  const [
    profileName,
    setProfileName,
  ] = useState("");

  const [
    profileStatus,
    setProfileStatus,
  ] = useState("");

  const [
    profileError,
    setProfileError,
  ] = useState("");

  const [
    profileSaving,
    setProfileSaving,
  ] = useState(false);

  const [
    profileImageLoading,
    setProfileImageLoading,
  ] = useState(false);

  /* =======================================================
     SERVIDOR
  ======================================================= */

  const [
    showCreateServer,
    setShowCreateServer,
  ] = useState(false);

  const [
    newServerName,
    setNewServerName,
  ] = useState("");

  const [
    serverError,
    setServerError,
  ] = useState("");

  const [
    showEditServer,
    setShowEditServer,
  ] = useState(false);

  const [
    editingServerName,
    setEditingServerName,
  ] = useState("");

  const [
    editServerError,
    setEditServerError,
  ] = useState("");

  const [
    inviteEmail,
    setInviteEmail,
  ] = useState("");

  const [
    inviteError,
    setInviteError,
  ] = useState("");

  const [
    inviteSuccess,
    setInviteSuccess,
  ] = useState("");

  /* =======================================================
     CANAIS
  ======================================================= */

  const [
    showCreateChannel,
    setShowCreateChannel,
  ] = useState(false);

  const [
    newChannelName,
    setNewChannelName,
  ] = useState("");

  const [
    channelError,
    setChannelError,
  ] = useState("");

  const [
    showEditChannel,
    setShowEditChannel,
  ] = useState(false);

  const [
    editingChannelId,
    setEditingChannelId,
  ] = useState("");

  const [
    editingChannelName,
    setEditingChannelName,
  ] = useState("");

  const [
    editChannelError,
    setEditChannelError,
  ] = useState("");

  /* =======================================================
     DADOS ATUAIS
  ======================================================= */

  const currentServer =
    servers.find(
      (server) =>
        server.id === currentServerId
    ) || null;

  const currentChannel =
    channels.find(
      (channel) =>
        channel.id === currentChannelId
    ) || null;

  const isServerOwner =
    !!currentServer &&
    !!currentUser &&
    currentServer.owner_id ===
      currentUser.id;

  /* =======================================================
     CARREGAR PERFIL
  ======================================================= */

  async function loadProfile(
    user: SupabaseUser
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(
        "id,name,email,avatar_url,status"
      )
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(
        "Erro ao carregar perfil:",
        error
      );

      setCurrentUser(null);
      return;
    }

    setCurrentUser(
      data as Profile
    );
  }

  /* =======================================================
     VERIFICAR SESSÃO
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function startAuth() {
      const {
        data,
        error,
      } =
        await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(error);

        setAuthChecking(false);
        return;
      }

      const user =
        data.session?.user || null;

      setAuthUser(user);

      if (user) {
        await loadProfile(user);
      }

      if (mounted) {
        setAuthChecking(false);
      }
    }

    startAuth();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          const user =
            session?.user || null;

          setAuthUser(user);

          if (user) {
            void loadProfile(user);
          } else {
            setCurrentUser(null);
          }

          setAuthChecking(false);
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =======================================================
     LOGIN
  ======================================================= */

  function clearAuthMessages() {
    setAuthError("");
    setAuthSuccess("");
  }

  function changeAuthMode(
    mode: "login" | "register"
  ) {
    setAuthMode(mode);

    setAuthError("");
    setAuthSuccess("");

    setAuthPassword("");
    setAuthConfirmPassword("");
  }

  async function handleRegister(
    event: FormEvent
  ) {
    event.preventDefault();

    clearAuthMessages();

    const name =
      authName.trim();

    const email =
      authEmail
        .trim()
        .toLowerCase();

    if (!name) {
      setAuthError(
        "Digite seu nome."
      );

      return;
    }

    if (
      !email ||
      !email.includes("@")
    ) {
      setAuthError(
        "Digite um e-mail válido."
      );

      return;
    }

    if (
      authPassword.length < 6
    ) {
      setAuthError(
        "A senha precisa ter pelo menos 6 caracteres."
      );

      return;
    }

    if (
      authPassword !==
      authConfirmPassword
    ) {
      setAuthError(
        "As senhas não são iguais."
      );

      return;
    }

    setAuthLoading(true);

    const {
      data,
      error,
    } =
      await supabase.auth.signUp({
        email,

        password:
          authPassword,

        options: {
          data: {
            name,
            status: "Online",
          },

          emailRedirectTo:
            window.location.origin,
        },
      });

    setAuthLoading(false);

    if (error) {
      setAuthError(
        error.message
      );

      return;
    }

    if (!data.session) {
      setLastSignupEmail(
        email
      );

      setAuthSuccess(
        `Conta criada. Enviamos um e-mail de confirmação para ${email}.`
      );

      setAuthMode(
        "login"
      );

      setAuthName("");
      setAuthPassword("");
      setAuthConfirmPassword("");

      return;
    }

    if (data.user) {
      setAuthUser(
        data.user
      );

      await loadProfile(
        data.user
      );
    }
  }

  async function handleLogin(
    event: FormEvent
  ) {
    event.preventDefault();

    clearAuthMessages();

    const email =
      authEmail
        .trim()
        .toLowerCase();

    if (!email) {
      setAuthError(
        "Digite seu e-mail."
      );

      return;
    }

    if (!authPassword) {
      setAuthError(
        "Digite sua senha."
      );

      return;
    }

    setAuthLoading(true);

    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword({
        email,
        password:
          authPassword,
      });

    setAuthLoading(false);

    if (error) {
      const text =
        error.message.toLowerCase();

      if (
        text.includes(
          "email not confirmed"
        )
      ) {
        setLastSignupEmail(
          email
        );

        setAuthError(
          "Seu e-mail ainda não foi confirmado."
        );

        return;
      }

      if (
        text.includes(
          "invalid login credentials"
        )
      ) {
        setAuthError(
          "E-mail ou senha incorretos."
        );

        return;
      }

      setAuthError(
        error.message
      );

      return;
    }

    if (data.user) {
      setAuthUser(
        data.user
      );

      await loadProfile(
        data.user
      );
    }

    setAuthPassword("");
  }

  async function resendConfirmation() {
    if (!lastSignupEmail) {
      setAuthError(
        "Digite o e-mail da conta."
      );

      return;
    }

    setResendLoading(
      true
    );

    clearAuthMessages();

    const { error } =
      await supabase.auth.resend({
        type: "signup",

        email:
          lastSignupEmail,

        options: {
          emailRedirectTo:
            window.location.origin,
        },
      });

    setResendLoading(
      false
    );

    if (error) {
      setAuthError(
        error.message
      );

      return;
    }

    setAuthSuccess(
      "E-mail de confirmação reenviado."
    );
  }

  async function logout() {
    await supabase.auth.signOut();

    setAuthUser(null);
    setCurrentUser(null);

    setServers([]);
    setChannels([]);
    setMessages([]);
    setMembers([]);

    setCurrentServerId(
      null
    );

    setCurrentChannelId(
      null
    );
  }

  /* =======================================================
     SERVIDORES
  ======================================================= */

  async function loadServers() {
    if (!currentUser) {
      return;
    }

    setAppLoading(true);

    const {
      data,
      error,
    } =
      await supabase
        .from("servers")
        .select(
          "id,owner_id,name,icon_url,created_at"
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (error) {
      console.error(
        "Erro ao carregar servidores:",
        error
      );

      setAppLoading(false);
      return;
    }

    const list =
      (data || []) as Server[];

    /*
      PRIMEIRO LOGIN:
      se o usuário ainda não tiver
      servidor, cria CONEXÃO automaticamente.
    */

    if (
      list.length === 0
    ) {
      const serverId =
        crypto.randomUUID();

      const {
        error:
          createServerError,
      } =
        await supabase
          .from("servers")
          .insert({
            id: serverId,
            owner_id:
              currentUser.id,
            name: "CONEXÃO",
          });

      if (createServerError) {
        console.error(
          createServerError
        );

        setAppLoading(
          false
        );

        return;
      }

      const {
        error:
          createChannelError,
      } =
        await supabase
          .from("channels")
          .insert({
            id:
              crypto.randomUUID(),

            server_id:
              serverId,

            name: "geral",

            description:
              "Converse com a comunidade",
          });

      if (
        createChannelError
      ) {
        console.error(
          createChannelError
        );
      }

      const {
        data:
          newServerData,
      } =
        await supabase
          .from("servers")
          .select(
            "id,owner_id,name,icon_url,created_at"
          )
          .eq(
            "id",
            serverId
          )
          .single();

      if (newServerData) {
        setServers([
          newServerData as Server,
        ]);

        setCurrentServerId(
          serverId
        );
      }

      setAppLoading(
        false
      );

      return;
    }

    setServers(
      list
    );

    setCurrentServerId(
      (previous) => {
        if (
          previous &&
          list.some(
            (server) =>
              server.id ===
              previous
          )
        ) {
          return previous;
        }

        return (
          list[0]?.id ||
          null
        );
      }
    );

    setAppLoading(
      false
    );
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void loadServers();
  }, [currentUser?.id]);

  function openCreateServer() {
    setNewServerName(
      ""
    );

    setServerError(
      ""
    );

    setShowCreateServer(
      true
    );
  }

  function closeCreateServer() {
    setShowCreateServer(
      false
    );

    setNewServerName(
      ""
    );

    setServerError(
      ""
    );
  }

  async function createServer() {
    if (!currentUser) {
      return;
    }

    const name =
      newServerName.trim();

    if (!name) {
      setServerError(
        "Digite o nome do servidor."
      );

      return;
    }

    const serverId =
      crypto.randomUUID();

    const {
      error,
    } =
      await supabase
        .from("servers")
        .insert({
          id: serverId,
          owner_id:
            currentUser.id,
          name,
        });

    if (error) {
      setServerError(
        error.message
      );

      return;
    }

    const {
      error:
        channelCreateError,
    } =
      await supabase
        .from("channels")
        .insert({
          id:
            crypto.randomUUID(),

          server_id:
            serverId,

          name: "geral",

          description:
            "Converse com a comunidade",
        });

    if (
      channelCreateError
    ) {
      console.error(
        channelCreateError
      );
    }

    await loadServers();

    setCurrentServerId(
      serverId
    );

    closeCreateServer();
  }

  function changeServer(
    serverId: string
  ) {
    setCurrentServerId(
      serverId
    );

    setCurrentChannelId(
      null
    );

    setChannels([]);
    setMessages([]);
  }

  function openEditServer() {
    if (!currentServer) {
      return;
    }

    setEditingServerName(
      currentServer.name
    );

    setEditServerError(
      ""
    );

    setInviteEmail(
      ""
    );

    setInviteError(
      ""
    );

    setInviteSuccess(
      ""
    );

    setShowEditServer(
      true
    );
  }

  function closeEditServer() {
    setShowEditServer(
      false
    );

    setEditServerError(
      ""
    );

    setInviteError(
      ""
    );

    setInviteSuccess(
      ""
    );
  }

  async function saveEditedServer() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    const name =
      editingServerName.trim();

    if (!name) {
      setEditServerError(
        "Digite um nome."
      );

      return;
    }

    const {
      error,
    } =
      await supabase
        .from("servers")
        .update({
          name,
        })
        .eq(
          "id",
          currentServer.id
        );

    if (error) {
      setEditServerError(
        error.message
      );

      return;
    }

    await loadServers();

    closeEditServer();
  }

  async function deleteServer() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Excluir "${currentServer.name}"?`
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from("servers")
        .delete()
        .eq(
          "id",
          currentServer.id
        );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    closeEditServer();

    setCurrentServerId(
      null
    );

    setCurrentChannelId(
      null
    );

    await loadServers();
  }

  /* =======================================================
     IMAGEM SERVIDOR
  ======================================================= */

  function selectServerImage() {
    serverFileInputRef
      .current
      ?.click();
  }

  async function handleServerImage(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Escolha uma imagem."
      );

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      alert(
        "A imagem deve ter menos de 10 MB."
      );

      return;
    }

    try {
      const icon =
        await compressImage(
          file,
          256,
          0.75
        );

      const {
        error,
      } =
        await supabase
          .from("servers")
          .update({
            icon_url:
              icon,
          })
          .eq(
            "id",
            currentServer.id
          );

      if (error) {
        alert(
          error.message
        );

        return;
      }

      await loadServers();
    } catch {
      alert(
        "Não foi possível processar a imagem."
      );
    }

    event.target.value =
      "";
  }

  async function removeServerImage() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    await supabase
      .from("servers")
      .update({
        icon_url: null,
      })
      .eq(
        "id",
        currentServer.id
      );

    await loadServers();
  }

  /* =======================================================
     MEMBROS
  ======================================================= */

  async function loadMembers(
    serverId: string
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "server_members"
        )
        .select(
          "user_id,role"
        )
        .eq(
          "server_id",
          serverId
        );

    if (error) {
      console.error(
        error
      );

      return;
    }

    const rows =
      data || [];

    const ids =
      rows.map(
        (row) =>
          row.user_id
      );

    if (
      ids.length === 0
    ) {
      setMembers([]);
      return;
    }

    const {
      data:
        profileData,
      error:
        profilesError,
    } =
      await supabase
        .from("profiles")
        .select(
          "id,name,email,avatar_url,status"
        )
        .in(
          "id",
          ids
        );

    if (
      profilesError
    ) {
      console.error(
        profilesError
      );

      return;
    }

    const profiles =
      (profileData ||
        []) as Profile[];

    const result: Member[] =
      rows
        .map((row) => {
          const profile =
            profiles.find(
              (item) =>
                item.id ===
                row.user_id
            );

          if (!profile) {
            return null;
          }

          return {
            ...profile,
            role:
              row.role,
          };
        })
        .filter(
          (
            item
          ): item is Member =>
            item !== null
        );

    setMembers(
      result
    );
  }

  async function inviteMember() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    const email =
      inviteEmail
        .trim()
        .toLowerCase();

    setInviteError(
      ""
    );

    setInviteSuccess(
      ""
    );

    if (!email) {
      setInviteError(
        "Digite o e-mail do usuário."
      );

      return;
    }

    const {
      data:
        profile,
      error:
        profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "id,name,email"
        )
        .eq(
          "email",
          email
        )
        .maybeSingle();

    if (
      profileError
    ) {
      setInviteError(
        profileError.message
      );

      return;
    }

    if (!profile) {
      setInviteError(
        "Esse usuário ainda não possui conta no CONEXÃO."
      );

      return;
    }

    if (
      profile.id ===
      currentUser?.id
    ) {
      setInviteError(
        "Você já está no servidor."
      );

      return;
    }

    const {
      error,
    } =
      await supabase
        .from(
          "server_members"
        )
        .insert({
          server_id:
            currentServer.id,

          user_id:
            profile.id,

          role:
            "member",
        });

    if (error) {
      if (
        error.code ===
        "23505"
      ) {
        setInviteError(
          "Esse usuário já está no servidor."
        );
      } else {
        setInviteError(
          error.message
        );
      }

      return;
    }

    setInviteEmail(
      ""
    );

    setInviteSuccess(
      `${profile.name} entrou no servidor.`
    );

    await loadMembers(
      currentServer.id
    );
  }

  /* =======================================================
     CANAIS
  ======================================================= */

  async function loadChannels(
    serverId: string
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("channels")
        .select(
          "id,server_id,name,description,created_at"
        )
        .eq(
          "server_id",
          serverId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (error) {
      console.error(
        "Erro canais:",
        error
      );

      return;
    }

    const list =
      (data ||
        []) as Channel[];

    setChannels(
      list
    );

    setCurrentChannelId(
      (previous) => {
        if (
          previous &&
          list.some(
            (channel) =>
              channel.id ===
              previous
          )
        ) {
          return previous;
        }

        return (
          list[0]?.id ||
          null
        );
      }
    );
  }

  useEffect(() => {
    if (!currentServerId) {
      setChannels([]);
      setMembers([]);
      return;
    }

    void loadChannels(
      currentServerId
    );

    void loadMembers(
      currentServerId
    );
  }, [currentServerId]);

  function openCreateChannel() {
    setNewChannelName(
      ""
    );

    setChannelError(
      ""
    );

    setShowCreateChannel(
      true
    );
  }

  function closeCreateChannel() {
    setShowCreateChannel(
      false
    );

    setChannelError(
      ""
    );
  }

  async function createChannel() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    const name =
      normalizeChannelName(
        newChannelName
      );

    if (!name) {
      setChannelError(
        "Digite um nome válido."
      );

      return;
    }

    const channelId =
      crypto.randomUUID();

    const {
      error,
    } =
      await supabase
        .from("channels")
        .insert({
          id:
            channelId,

          server_id:
            currentServer.id,

          name,

          description:
            `Canal #${name}`,
        });

    if (error) {
      if (
        error.code ===
        "23505"
      ) {
        setChannelError(
          "Esse canal já existe."
        );
      } else {
        setChannelError(
          error.message
        );
      }

      return;
    }

    await loadChannels(
      currentServer.id
    );

    setCurrentChannelId(
      channelId
    );

    closeCreateChannel();
  }

  function changeChannel(
    channelId: string
  ) {
    setCurrentChannelId(
      channelId
    );

    setMessage(
      ""
    );
  }

  function openEditChannel(
    channel: Channel
  ) {
    setEditingChannelId(
      channel.id
    );

    setEditingChannelName(
      channel.name
    );

    setEditChannelError(
      ""
    );

    setShowEditChannel(
      true
    );
  }

  function closeEditChannel() {
    setShowEditChannel(
      false
    );

    setEditingChannelId(
      ""
    );

    setEditingChannelName(
      ""
    );

    setEditChannelError(
      ""
    );
  }

  async function saveEditedChannel() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    const name =
      normalizeChannelName(
        editingChannelName
      );

    if (!name) {
      setEditChannelError(
        "Digite um nome válido."
      );

      return;
    }

    const {
      error,
    } =
      await supabase
        .from("channels")
        .update({
          name,

          description:
            `Canal #${name}`,
        })
        .eq(
          "id",
          editingChannelId
        );

    if (error) {
      setEditChannelError(
        error.message
      );

      return;
    }

    await loadChannels(
      currentServer.id
    );

    closeEditChannel();
  }

  async function deleteChannel(
    channelId: string
  ) {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    if (
      channels.length ===
      1
    ) {
      alert(
        "O servidor precisa ter pelo menos um canal."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Excluir este canal?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from("channels")
        .delete()
        .eq(
          "id",
          channelId
        );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    if (
      currentChannelId ===
      channelId
    ) {
      setCurrentChannelId(
        null
      );
    }

    await loadChannels(
      currentServer.id
    );
  }

  /* =======================================================
     MENSAGENS
  ======================================================= */

  async function fetchMessages(
    channelId: string
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("messages")
        .select(
          "id,channel_id,user_id,content,created_at"
        )
        .eq(
          "channel_id",
          channelId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (error) {
      console.error(
        "Erro mensagens:",
        error
      );

      return;
    }

    const rows =
      (data ||
        []) as DatabaseMessage[];

    if (
      rows.length === 0
    ) {
      setMessages([]);
      return;
    }

    const userIds =
      Array.from(
        new Set(
          rows.map(
            (row) =>
              row.user_id
          )
        )
      );

    const {
      data:
        profilesData,
    } =
      await supabase
        .from("profiles")
        .select(
          "id,name,avatar_url"
        )
        .in(
          "id",
          userIds
        );

    const profileMap =
      new Map<
        string,
        {
          name: string;
          avatar_url:
            string | null;
        }
      >();

    for (
      const profile of
        profilesData || []
    ) {
      profileMap.set(
        profile.id,
        {
          name:
            profile.name,

          avatar_url:
            profile.avatar_url,
        }
      );
    }

    const finalMessages: ChatMessage[] =
      rows.map((row) => {
        const profile =
          profileMap.get(
            row.user_id
          );

        return {
          ...row,

          author:
            profile?.name ||
            "Usuário",

          avatar_url:
            profile?.avatar_url ||
            null,
        };
      });

    setMessages(
      finalMessages
    );
  }

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!currentChannelId) {
      setMessages([]);
      return;
    }

    void fetchMessages(
      currentChannelId
    );

    const realtimeChannel =
      supabase
        .channel(
          `messages-${currentChannelId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",

            schema: "public",

            table:
              "messages",

            filter:
              `channel_id=eq.${currentChannelId}`,
          },

          () => {
            void fetchMessages(
              currentChannelId
            );
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        realtimeChannel
      );
    };
  }, [currentChannelId]);

  async function sendMessage() {
    if (
      !currentUser ||
      !currentChannelId
    ) {
      return;
    }

    const text =
      message.trim();

    if (!text) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from("messages")
        .insert({
          id:
            crypto.randomUUID(),

          channel_id:
            currentChannelId,

          user_id:
            currentUser.id,

          content:
            text,
        });

    if (error) {
      alert(
        error.message
      );

      return;
    }

    setMessage(
      ""
    );

    /*
      O realtime normalmente atualiza,
      mas também fazemos refresh imediato.
    */

    await fetchMessages(
      currentChannelId
    );
  }

  function handleMessageKeyDown(
    event:
      KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key ===
      "Enter"
    ) {
      void sendMessage();
    }
  }

  /* =======================================================
     PERFIL REAL
  ======================================================= */

  function openProfile() {
    if (!currentUser) {
      return;
    }

    setProfileName(
      currentUser.name
    );

    setProfileStatus(
      currentUser.status
    );

    setProfileError(
      ""
    );

    setShowProfile(
      true
    );
  }

  function closeProfile() {
    setShowProfile(
      false
    );

    setProfileError(
      ""
    );
  }

  async function saveProfile() {
    if (!currentUser) {
      return;
    }

    const name =
      profileName.trim();

    const status =
      profileStatus.trim() ||
      "Online";

    if (!name) {
      setProfileError(
        "Digite seu nome."
      );

      return;
    }

    setProfileSaving(
      true
    );

    const {
      error,
    } =
      await supabase
        .from("profiles")
        .update({
          name,
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          currentUser.id
        );

    setProfileSaving(
      false
    );

    if (error) {
      setProfileError(
        error.message
      );

      return;
    }

    if (authUser) {
      await loadProfile(
        authUser
      );
    }

    if (
      currentServerId
    ) {
      await loadMembers(
        currentServerId
      );
    }

    if (
      currentChannelId
    ) {
      await fetchMessages(
        currentChannelId
      );
    }

    closeProfile();
  }

  function selectProfileImage() {
    profileFileInputRef
      .current
      ?.click();
  }

  async function handleProfileImage(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    if (!currentUser) {
      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Escolha uma imagem."
      );

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      alert(
        "A imagem deve ter menos de 10 MB."
      );

      return;
    }

    try {
      setProfileImageLoading(
        true
      );

      const avatar =
        await compressImage(
          file,
          384,
          0.75
        );

      const {
        error,
      } =
        await supabase
          .from("profiles")
          .update({
            avatar_url:
              avatar,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            currentUser.id
          );

      if (error) {
        alert(
          error.message
        );

        return;
      }

      if (authUser) {
        await loadProfile(
          authUser
        );
      }

      if (
        currentServerId
      ) {
        await loadMembers(
          currentServerId
        );
      }

      if (
        currentChannelId
      ) {
        await fetchMessages(
          currentChannelId
        );
      }
    } catch {
      alert(
        "Não foi possível processar a imagem."
      );
    } finally {
      setProfileImageLoading(
        false
      );

      event.target.value =
        "";
    }
  }

  async function removeProfileImage() {
    if (!currentUser) {
      return;
    }

    await supabase
      .from("profiles")
      .update({
        avatar_url: null,
      })
      .eq(
        "id",
        currentUser.id
      );

    if (authUser) {
      await loadProfile(
        authUser
      );
    }
  }

  /* =======================================================
     TELA CARREGANDO AUTH
  ======================================================= */

  if (authChecking) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>
              CONEXÃO
            </h2>

            <p>
              Verificando sua conta...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     LOGIN
  ======================================================= */

  if (!currentUser) {
    return (
      <div className="auth-page">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />

        <div className="auth-brand">
          <div className="auth-logo">
            C
          </div>

          <div>
            <h1>
              CONEXÃO
            </h1>

            <p>
              Converse. Crie.
              Conecte-se.
            </p>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>
              {authMode ===
              "login"
                ? "Bem-vindo de volta"
                : "Criar sua conta"}
            </h2>

            <p>
              {authMode ===
              "login"
                ? "Entre para continuar no CONEXÃO."
                : "Crie sua conta e confirme seu e-mail."}
            </p>
          </div>

          <form
            onSubmit={
              authMode ===
              "login"
                ? handleLogin
                : handleRegister
            }
          >
            {authMode ===
              "register" && (
              <div className="auth-field">
                <label>
                  NOME
                </label>

                <input
                  type="text"

                  placeholder="Seu nome"

                  value={
                    authName
                  }

                  onChange={(
                    event
                  ) =>
                    setAuthName(
                      event.target
                        .value
                    )
                  }
                />
              </div>
            )}

            <div className="auth-field">
              <label>
                E-MAIL
              </label>

              <input
                type="email"

                placeholder="voce@email.com"

                value={
                  authEmail
                }

                onChange={(
                  event
                ) =>
                  setAuthEmail(
                    event.target
                      .value
                  )
                }
              />
            </div>

            <div className="auth-field">
              <label>
                SENHA
              </label>

              <input
                type="password"

                placeholder="Mínimo 6 caracteres"

                value={
                  authPassword
                }

                onChange={(
                  event
                ) =>
                  setAuthPassword(
                    event.target
                      .value
                  )
                }
              />
            </div>

            {authMode ===
              "register" && (
              <div className="auth-field">
                <label>
                  CONFIRMAR SENHA
                </label>

                <input
                  type="password"

                  placeholder="Repita sua senha"

                  value={
                    authConfirmPassword
                  }

                  onChange={(
                    event
                  ) =>
                    setAuthConfirmPassword(
                      event.target
                        .value
                    )
                  }
                />
              </div>
            )}

            {authError && (
              <div className="auth-error">
                {
                  authError
                }
              </div>
            )}

            {authSuccess && (
              <div
                className="auth-error"

                style={{
                  color:
                    "#72e6a0",

                  borderColor:
                    "rgba(70,220,130,.25)",

                  background:
                    "rgba(70,220,130,.06)",
                }}
              >
                {
                  authSuccess
                }
              </div>
            )}

            <button
              className="auth-submit"

              type="submit"

              disabled={
                authLoading
              }
            >
              {authLoading
                ? "Aguarde..."
                : authMode ===
                    "login"
                  ? "Entrar"
                  : "Criar conta"}
            </button>
          </form>

          {lastSignupEmail && (
            <button
              type="button"

              onClick={
                resendConfirmation
              }

              disabled={
                resendLoading
              }

              style={{
                width: "100%",
                marginTop:
                  "12px",
                border: "none",
                background:
                  "transparent",
                color:
                  "#8295ff",
                cursor:
                  "pointer",
              }}
            >
              {resendLoading
                ? "Enviando..."
                : "Reenviar confirmação"}
            </button>
          )}

          <div className="auth-switch">
            {authMode ===
            "login" ? (
              <>
                Ainda não tem
                uma conta?

                <button
                  type="button"

                  onClick={() =>
                    changeAuthMode(
                      "register"
                    )
                  }
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já possui uma
                conta?

                <button
                  type="button"

                  onClick={() =>
                    changeAuthMode(
                      "login"
                    )
                  }
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     CARREGANDO SERVIDORES
  ======================================================= */

  if (
    appLoading &&
    servers.length === 0
  ) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>
              CONEXÃO
            </h2>

            <p>
              Carregando comunidades...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     APP
  ======================================================= */

  return (
    <div className="app">
      <input
        ref={
          serverFileInputRef
        }

        className="server-file-input"

        type="file"

        accept="image/*"

        onChange={
          handleServerImage
        }
      />

      <input
        ref={
          profileFileInputRef
        }

        className="server-file-input"

        type="file"

        accept="image/*"

        onChange={
          handleProfileImage
        }
      />

      {/* SERVIDORES */}

      <aside className="servers">
        <div className="logo">
          C
        </div>

        {servers.map(
          (server) => (
            <button
              key={
                server.id
              }

              className={
                server.id ===
                currentServerId
                  ? "server active"
                  : "server"
              }

              onClick={() =>
                changeServer(
                  server.id
                )
              }

              title={
                server.name
              }
            >
              {server.icon_url ? (
                <img
                  src={
                    server.icon_url
                  }

                  alt={
                    server.name
                  }

                  className="server-image"
                />
              ) : (
                createShortName(
                  server.name
                )
              )}
            </button>
          )
        )}

        <button
          className="server add"

          onClick={
            openCreateServer
          }

          title="Criar servidor"
        >
          +
        </button>
      </aside>

      {/* CANAIS */}

      <aside className="channels">
        {currentServer && (
          <>
            <div className="workspace">
              <div className="workspace-info">
                <h2>
                  {
                    currentServer.name
                  }
                </h2>

                <span>
                  {isServerOwner
                    ? "Proprietário"
                    : "Membro"}
                </span>
              </div>

              {isServerOwner && (
                <button
                  className="workspace-settings"

                  onClick={
                    openEditServer
                  }

                  title="Configurações"
                >
                  ⚙
                </button>
              )}
            </div>

            <div className="channel-group">
              <div className="channel-group-title">
                <p>
                  CANAIS DE TEXTO
                </p>

                {isServerOwner && (
                  <button
                    className="add-channel"

                    onClick={
                      openCreateChannel
                    }
                  >
                    +
                  </button>
                )}
              </div>

              {channels.map(
                (channel) => (
                  <div
                    className="channel-row"

                    key={
                      channel.id
                    }
                  >
                    <button
                      className={
                        channel.id ===
                        currentChannelId
                          ? "channel active"
                          : "channel"
                      }

                      onClick={() =>
                        changeChannel(
                          channel.id
                        )
                      }
                    >
                      #{" "}
                      {
                        channel.name
                      }
                    </button>

                    {isServerOwner && (
                      <div className="channel-actions">
                        <button
                          onClick={() =>
                            openEditChannel(
                              channel
                            )
                          }
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() =>
                            deleteChannel(
                              channel.id
                            )
                          }
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="channel-group">
              <p>
                CANAIS DE VOZ
              </p>

              <button className="channel">
                🔊 Sala geral
              </button>

              <button className="channel">
                🔊 Jogando
              </button>
            </div>
          </>
        )}

        {/* PERFIL */}

        <div
          className="profile profile-clickable"

          onClick={
            openProfile
          }
        >
          <div className="avatar">
            {currentUser.avatar_url ? (
              <img
                src={
                  currentUser.avatar_url
                }

                alt=""

                className="profile-avatar-image"
              />
            ) : (
              currentUser.name
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div className="profile-info">
            <strong>
              {
                currentUser.name
              }
            </strong>

            <span>
              {
                currentUser.status
              }
            </span>
          </div>

          <button
            className="settings-button"

            onClick={(
              event
            ) => {
              event.stopPropagation();

              void logout();
            }}

            title="Sair"
          >
            ↪
          </button>
        </div>
      </aside>

      {/* CHAT */}

      <main className="chat">
        {currentChannel ? (
          <>
            <header className="chat-header">
              <div className="chat-title">
                <strong>
                  #{" "}
                  {
                    currentChannel.name
                  }
                </strong>

                <span>
                  {
                    currentChannel.description
                  }
                </span>
              </div>

              <div className="header-actions">
                <button>
                  🔔
                </button>

                <button>
                  👥
                </button>
              </div>
            </header>

            <section className="messages">
              <div className="welcome">
                <div className="welcome-icon">
                  #
                </div>

                <h1>
                  Bem-vindo ao #
                  {
                    currentChannel.name
                  }
                </h1>

                <p>
                  {
                    currentChannel.description
                  }
                </p>
              </div>

              {messages.map(
                (item) => (
                  <div
                    className="message"

                    key={
                      item.id
                    }
                  >
                    <div className="message-avatar">
                      {item.avatar_url ? (
                        <img
                          src={
                            item.avatar_url
                          }

                          alt=""

                          className="member-profile-image"
                        />
                      ) : (
                        item.author
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <div className="message-content">
                      <div className="message-info">
                        <strong>
                          {
                            item.author
                          }
                        </strong>

                        <span>
                          {new Date(
                            item.created_at
                          ).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour:
                                "2-digit",

                              minute:
                                "2-digit",
                            }
                          )}
                        </span>
                      </div>

                      <p>
                        {
                          item.content
                        }
                      </p>
                    </div>
                  </div>
                )
              )}
            </section>

            <div className="message-box">
              <button>
                +
              </button>

              <input
                type="text"

                placeholder={`Mensagem em #${currentChannel.name}`}

                value={
                  message
                }

                onChange={(
                  event
                ) =>
                  setMessage(
                    event.target
                      .value
                  )
                }

                onKeyDown={
                  handleMessageKeyDown
                }
              />

              <button>
                😊
              </button>

              <button
                onClick={() =>
                  void sendMessage()
                }
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div className="welcome">
            <h1>
              CONEXÃO
            </h1>

            <p>
              Selecione um canal.
            </p>
          </div>
        )}
      </main>

      {/* MEMBROS */}

      <aside className="members">
        <h3>
          MEMBROS —{" "}
          {
            members.length
          }
        </h3>

        {members.map(
          (member) => (
            <div
              className="member"

              key={
                member.id
              }
            >
              <div className="member-avatar online">
                {member.avatar_url ? (
                  <img
                    src={
                      member.avatar_url
                    }

                    alt=""

                    className="member-profile-image"
                  />
                ) : (
                  member.name
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <span>
                {
                  member.name
                }

                {member.role ===
                  "owner" &&
                  " 👑"}
              </span>
            </div>
          )
        )}
      </aside>

      {/* CRIAR SERVIDOR */}

      {showCreateServer && (
        <div
          className="modal-overlay"

          onMouseDown={
            closeCreateServer
          }
        >
          <div
            className="modal-card"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  Criar servidor
                </h2>

                <p>
                  Crie uma nova comunidade.
                </p>
              </div>

              <button
                className="modal-close"

                onClick={
                  closeCreateServer
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <label>
                NOME DO SERVIDOR
              </label>

              <div className="channel-name-input">
                <input
                  value={
                    newServerName
                  }

                  onChange={(
                    event
                  ) => {
                    setNewServerName(
                      event.target
                        .value
                    );

                    setServerError(
                      ""
                    );
                  }}
                />
              </div>

              {serverError && (
                <p className="modal-error">
                  {
                    serverError
                  }
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel"

                onClick={
                  closeCreateServer
                }
              >
                Cancelar
              </button>

              <button
                className="modal-create"

                onClick={() =>
                  void createServer()
                }
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURAÇÕES SERVIDOR */}

      {showEditServer &&
        currentServer && (
        <div
          className="modal-overlay"

          onMouseDown={
            closeEditServer
          }
        >
          <div
            className="modal-card"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  Configurações
                </h2>

                <p>
                  Gerencie o servidor.
                </p>
              </div>

              <button
                className="modal-close"

                onClick={
                  closeEditServer
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="server-icon-editor">
                <div className="server-icon-preview">
                  {currentServer.icon_url ? (
                    <img
                      src={
                        currentServer.icon_url
                      }

                      alt=""
                    />
                  ) : (
                    createShortName(
                      currentServer.name
                    )
                  )}
                </div>

                <div className="server-icon-options">
                  <strong>
                    Imagem do servidor
                  </strong>

                  <div className="server-image-buttons">
                    <button
                      className="server-upload-button"

                      onClick={
                        selectServerImage
                      }
                    >
                      Escolher imagem
                    </button>

                    {currentServer.icon_url && (
                      <button
                        className="server-remove-image"

                        onClick={() =>
                          void removeServerImage()
                        }
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label>
                NOME DO SERVIDOR
              </label>

              <div className="channel-name-input">
                <input
                  value={
                    editingServerName
                  }

                  onChange={(
                    event
                  ) =>
                    setEditingServerName(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              {editServerError && (
                <p className="modal-error">
                  {
                    editServerError
                  }
                </p>
              )}

              <div
                style={{
                  marginTop:
                    "24px",
                }}
              >
                <label>
                  ADICIONAR MEMBRO
                </label>

                <div className="friend-add-row">
                  <input
                    type="email"

                    placeholder="email@exemplo.com"

                    value={
                      inviteEmail
                    }

                    onChange={(
                      event
                    ) => {
                      setInviteEmail(
                        event.target
                          .value
                      );

                      setInviteError(
                        ""
                      );

                      setInviteSuccess(
                        ""
                      );
                    }}
                  />

                  <button
                    onClick={() =>
                      void inviteMember()
                    }
                  >
                    Adicionar
                  </button>
                </div>

                {inviteError && (
                  <p className="modal-error">
                    {
                      inviteError
                    }
                  </p>
                )}

                {inviteSuccess && (
                  <p
                    style={{
                      color:
                        "#72e6a0",

                      fontSize:
                        "12px",

                      marginTop:
                        "8px",
                    }}
                  >
                    {
                      inviteSuccess
                    }
                  </p>
                )}
              </div>

              <div className="danger-zone">
                <div>
                  <strong>
                    Excluir servidor
                  </strong>

                  <span>
                    Canais e mensagens serão apagados.
                  </span>
                </div>

                <button
                  onClick={() =>
                    void deleteServer()
                  }
                >
                  Excluir
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel"

                onClick={
                  closeEditServer
                }
              >
                Cancelar
              </button>

              <button
                className="modal-create"

                onClick={() =>
                  void saveEditedServer()
                }
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRIAR CANAL */}

      {showCreateChannel && (
        <div
          className="modal-overlay"

          onMouseDown={
            closeCreateChannel
          }
        >
          <div
            className="modal-card"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  Criar canal
                </h2>

                <p>
                  Crie um canal de texto.
                </p>
              </div>

              <button
                className="modal-close"

                onClick={
                  closeCreateChannel
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <label>
                NOME DO CANAL
              </label>

              <div className="channel-name-input">
                <span>
                  #
                </span>

                <input
                  value={
                    newChannelName
                  }

                  onChange={(
                    event
                  ) => {
                    setNewChannelName(
                      event.target
                        .value
                    );

                    setChannelError(
                      ""
                    );
                  }}
                />
              </div>

              {channelError && (
                <p className="modal-error">
                  {
                    channelError
                  }
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel"

                onClick={
                  closeCreateChannel
                }
              >
                Cancelar
              </button>

              <button
                className="modal-create"

                onClick={() =>
                  void createChannel()
                }
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDITAR CANAL */}

      {showEditChannel && (
        <div
          className="modal-overlay"

          onMouseDown={
            closeEditChannel
          }
        >
          <div
            className="modal-card"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  Editar canal
                </h2>

                <p>
                  Altere o nome do canal.
                </p>
              </div>

              <button
                className="modal-close"

                onClick={
                  closeEditChannel
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <label>
                NOME DO CANAL
              </label>

              <div className="channel-name-input">
                <span>
                  #
                </span>

                <input
                  value={
                    editingChannelName
                  }

                  onChange={(
                    event
                  ) => {
                    setEditingChannelName(
                      event.target
                        .value
                    );

                    setEditChannelError(
                      ""
                    );
                  }}
                />
              </div>

              {editChannelError && (
                <p className="modal-error">
                  {
                    editChannelError
                  }
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel"

                onClick={
                  closeEditChannel
                }
              >
                Cancelar
              </button>

              <button
                className="modal-create"

                onClick={() =>
                  void saveEditedChannel()
                }
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERFIL */}

      {showProfile && (
        <div
          className="modal-overlay"

          onMouseDown={
            closeProfile
          }
        >
          <div
            className="modal-card profile-modal"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  Meu perfil
                </h2>

                <p>
                  Perfil salvo no Supabase.
                </p>
              </div>

              <button
                className="modal-close"

                onClick={
                  closeProfile
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="profile-editor">
                <div className="profile-big-avatar">
                  {currentUser.avatar_url ? (
                    <img
                      src={
                        currentUser.avatar_url
                      }

                      alt=""
                    />
                  ) : (
                    currentUser.name
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>

                <div className="profile-photo-options">
                  <strong>
                    Foto de perfil
                  </strong>

                  <div className="profile-photo-buttons">
                    <button
                      className="server-upload-button"

                      onClick={
                        selectProfileImage
                      }

                      disabled={
                        profileImageLoading
                      }
                    >
                      {profileImageLoading
                        ? "Processando..."
                        : "Escolher imagem"}
                    </button>

                    {currentUser.avatar_url && (
                      <button
                        className="server-remove-image"

                        onClick={() =>
                          void removeProfileImage()
                        }
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label>
                NOME
              </label>

              <div className="channel-name-input">
                <input
                  value={
                    profileName
                  }

                  onChange={(
                    event
                  ) =>
                    setProfileName(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <label className="profile-status-label">
                STATUS
              </label>

              <div className="channel-name-input">
                <input
                  value={
                    profileStatus
                  }

                  maxLength={40}

                  onChange={(
                    event
                  ) =>
                    setProfileStatus(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              {profileError && (
                <p className="modal-error">
                  {
                    profileError
                  }
                </p>
              )}

              <div className="profile-email-box">
                <span>
                  E-MAIL
                </span>

                <strong>
                  {
                    currentUser.email
                  }
                </strong>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel"

                onClick={
                  closeProfile
                }
              >
                Cancelar
              </button>

              <button
                className="modal-create"

                disabled={
                  profileSaving
                }

                onClick={() =>
                  void saveProfile()
                }
              >
                {profileSaving
                  ? "Salvando..."
                  : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;