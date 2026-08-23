import { useEffect, useRef, useState } from "react";
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

function isRecoveryUrl() {
  const hash =
    window.location.hash.toLowerCase();

  const search =
    window.location.search.toLowerCase();

  return (
    hash.includes("type=recovery") ||
    search.includes("type=recovery")
  );
}

function getInitialInviteCode() {
  const code =
    new URLSearchParams(
      window.location.search
    )
      .get("invite")
      ?.trim();

  if (code) {
    localStorage.setItem(
      "conexao_pending_invite",
      code
    );

    return code;
  }

  return (
    localStorage.getItem(
      "conexao_pending_invite"
    ) || ""
  );
}

function removeInviteFromUrl() {
  const url =
    new URL(window.location.href);

  url.searchParams.delete("invite");

  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}${url.hash}`
  );
}

function compressImage(
  file: File,
  maxSize = 512,
  quality = 0.8
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const image =
          new Image();

        image.onload = () => {
          let width =
            image.width;

          let height =
            image.height;

          if (
            width > maxSize ||
            height > maxSize
          ) {
            if (width > height) {
              height =
                Math.round(
                  (height *
                    maxSize) /
                    width
                );

              width =
                maxSize;
            } else {
              width =
                Math.round(
                  (width *
                    maxSize) /
                    height
                );

              height =
                maxSize;
            }
          }

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            width;

          canvas.height =
            height;

          const context =
            canvas.getContext(
              "2d"
            );

          if (!context) {
            reject(
              new Error(
                "Não foi possível processar a imagem."
              )
            );

            return;
          }

          context.imageSmoothingEnabled =
            true;

          context.imageSmoothingQuality =
            "high";

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

        image.onerror =
          () => {
            reject(
              new Error(
                "Não foi possível abrir a imagem."
              )
            );
          };

        image.src =
          reader.result as string;
      };

      reader.onerror =
        () => {
          reject(
            new Error(
              "Não foi possível ler a imagem."
            )
          );
        };

      reader.readAsDataURL(
        file
      );
    }
  );
}

function App() {
  const profileFileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const serverFileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const inviteProcessingRef =
    useRef(false);

  /* =========================================
     AUTENTICAÇÃO
  ========================================= */

  const [
    authUser,
    setAuthUser,
  ] =
    useState<SupabaseUser | null>(
      null
    );

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    authChecking,
    setAuthChecking,
  ] =
    useState(true);

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(false);

  const [
    authMode,
    setAuthMode,
  ] =
    useState<
      "login" | "register"
    >("login");

  const [
    authName,
    setAuthName,
  ] =
    useState("");

  const [
    authEmail,
    setAuthEmail,
  ] =
    useState("");

  const [
    authPassword,
    setAuthPassword,
  ] =
    useState("");

  const [
    authConfirmPassword,
    setAuthConfirmPassword,
  ] =
    useState("");

  const [
    authError,
    setAuthError,
  ] =
    useState("");

  const [
    authSuccess,
    setAuthSuccess,
  ] =
    useState("");

  const [
    lastSignupEmail,
    setLastSignupEmail,
  ] =
    useState("");

  const [
    resendLoading,
    setResendLoading,
  ] =
    useState(false);

  /* =========================================
     REDEFINIÇÃO DE SENHA
  ========================================= */

  const [
    showForgotPassword,
    setShowForgotPassword,
  ] =
    useState(false);

  const [
    recoveryEmail,
    setRecoveryEmail,
  ] =
    useState("");

  const [
    recoveryLoading,
    setRecoveryLoading,
  ] =
    useState(false);

  const [
    recoveryError,
    setRecoveryError,
  ] =
    useState("");

  const [
    recoverySuccess,
    setRecoverySuccess,
  ] =
    useState("");

  const [
    passwordRecoveryMode,
    setPasswordRecoveryMode,
  ] =
    useState(() =>
      isRecoveryUrl()
    );

  const [
    newPassword,
    setNewPassword,
  ] =
    useState("");

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] =
    useState("");

  const [
    newPasswordLoading,
    setNewPasswordLoading,
  ] =
    useState(false);

  const [
    newPasswordError,
    setNewPasswordError,
  ] =
    useState("");

  /* =========================================
     CONVITES
  ========================================= */

  const [
    pendingInviteCode,
    setPendingInviteCode,
  ] =
    useState(
      getInitialInviteCode
    );

  const [
    joinInviteLoading,
    setJoinInviteLoading,
  ] =
    useState(false);

  const [
    joinInviteError,
    setJoinInviteError,
  ] =
    useState("");

  const [
    joinInviteSuccess,
    setJoinInviteSuccess,
  ] =
    useState("");

  const [
    showInviteModal,
    setShowInviteModal,
  ] =
    useState(false);

  const [
    inviteLink,
    setInviteLink,
  ] =
    useState("");

  const [
    inviteLoading,
    setInviteLoading,
  ] =
    useState(false);

  const [
    inviteError,
    setInviteError,
  ] =
    useState("");

  const [
    inviteCopied,
    setInviteCopied,
  ] =
    useState(false);

  /* =========================================
     APP
  ========================================= */

  const [
    appLoading,
    setAppLoading,
  ] =
    useState(false);

  const [
    servers,
    setServers,
  ] =
    useState<Server[]>([]);

  const [
    currentServerId,
    setCurrentServerId,
  ] =
    useState<
      string | null
    >(null);

  const [
    channels,
    setChannels,
  ] =
    useState<Channel[]>([]);

  const [
    currentChannelId,
    setCurrentChannelId,
  ] =
    useState<
      string | null
    >(null);

  const [
    messages,
    setMessages,
  ] =
    useState<
      ChatMessage[]
    >([]);

  const [
    members,
    setMembers,
  ] =
    useState<Member[]>([]);

  const [
    message,
    setMessage,
  ] =
    useState("");

  /* =========================================
     PERFIL
  ========================================= */

  const [
    showProfile,
    setShowProfile,
  ] =
    useState(false);

  const [
    profileName,
    setProfileName,
  ] =
    useState("");

  const [
    profileStatus,
    setProfileStatus,
  ] =
    useState("");

  const [
    profileError,
    setProfileError,
  ] =
    useState("");

  const [
    profileSaving,
    setProfileSaving,
  ] =
    useState(false);

  const [
    profileImageLoading,
    setProfileImageLoading,
  ] =
    useState(false);

  /* =========================================
     SERVIDOR
  ========================================= */

  const [
    showCreateServer,
    setShowCreateServer,
  ] =
    useState(false);

  const [
    newServerName,
    setNewServerName,
  ] =
    useState("");

  const [
    serverError,
    setServerError,
  ] =
    useState("");

  const [
    showEditServer,
    setShowEditServer,
  ] =
    useState(false);

  const [
    editingServerName,
    setEditingServerName,
  ] =
    useState("");

  const [
    editServerError,
    setEditServerError,
  ] =
    useState("");

  const [
    inviteEmail,
    setInviteEmail,
  ] =
    useState("");

  const [
    inviteMemberError,
    setInviteMemberError,
  ] =
    useState("");

  const [
    inviteMemberSuccess,
    setInviteMemberSuccess,
  ] =
    useState("");

  /* =========================================
     CANAIS
  ========================================= */

  const [
    showCreateChannel,
    setShowCreateChannel,
  ] =
    useState(false);

  const [
    newChannelName,
    setNewChannelName,
  ] =
    useState("");

  const [
    channelError,
    setChannelError,
  ] =
    useState("");

  const [
    showEditChannel,
    setShowEditChannel,
  ] =
    useState(false);

  const [
    editingChannelId,
    setEditingChannelId,
  ] =
    useState("");

  const [
    editingChannelName,
    setEditingChannelName,
  ] =
    useState("");

  const [
    editChannelError,
    setEditChannelError,
  ] =
    useState("");

  const currentServer =
    servers.find(
      (server) =>
        server.id ===
        currentServerId
    ) || null;

  const currentChannel =
    channels.find(
      (channel) =>
        channel.id ===
        currentChannelId
    ) || null;

  const isServerOwner =
    !!currentServer &&
    !!currentUser &&
    currentServer.owner_id ===
      currentUser.id;

  /* =========================================
     PERFIL DO USUÁRIO
  ========================================= */

  async function loadProfile(
    user: SupabaseUser
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("profiles")
        .select(
          "id,name,email,avatar_url,status"
        )
        .eq(
          "id",
          user.id
        )
        .single();

    if (error) {
      console.error(
        "Erro ao carregar perfil:",
        error
      );

      setCurrentUser(
        null
      );

      return;
    }

    setCurrentUser(
      data as Profile
    );
  }

  /* =========================================
     SESSÃO
  ========================================= */

  useEffect(() => {
    let mounted =
      true;

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
        console.error(
          error
        );

        setAuthChecking(
          false
        );

        return;
      }

      const user =
        data.session
          ?.user ||
        null;

      setAuthUser(
        user
      );

      if (
        user &&
        !isRecoveryUrl()
      ) {
        await loadProfile(
          user
        );
      }

      if (mounted) {
        setAuthChecking(
          false
        );
      }
    }

    void startAuth();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          event,
          session
        ) => {
          const user =
            session?.user ||
            null;

          if (
            event ===
            "PASSWORD_RECOVERY"
          ) {
            setPasswordRecoveryMode(
              true
            );

            setAuthUser(
              user
            );

            setCurrentUser(
              null
            );

            setShowForgotPassword(
              false
            );

            setNewPassword(
              ""
            );

            setConfirmNewPassword(
              ""
            );

            setNewPasswordError(
              ""
            );

            setAuthChecking(
              false
            );

            return;
          }

          setAuthUser(
            user
          );

          if (
            user &&
            !isRecoveryUrl()
          ) {
            void loadProfile(
              user
            );
          }

          if (!user) {
            setCurrentUser(
              null
            );
          }

          setAuthChecking(
            false
          );
        }
      );

    return () => {
      mounted =
        false;

      subscription.unsubscribe();
    };
  }, []);

  function clearAuthMessages() {
    setAuthError("");
    setAuthSuccess("");
  }

  function changeAuthMode(
    mode:
      | "login"
      | "register"
  ) {
    setAuthMode(
      mode
    );

    setAuthError(
      ""
    );

    setAuthSuccess(
      ""
    );

    setAuthPassword(
      ""
    );

    setAuthConfirmPassword(
      ""
    );

    setShowForgotPassword(
      false
    );
  }

  /* =========================================
     CADASTRO
  ========================================= */

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
      !email.includes(
        "@"
      )
    ) {
      setAuthError(
        "Digite um e-mail válido."
      );

      return;
    }

    if (
      authPassword.length <
      6
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

    setAuthLoading(
      true
    );

    const redirectUrl =
      pendingInviteCode
        ? `${
            window
              .location
              .origin
          }/?invite=${encodeURIComponent(
            pendingInviteCode
          )}`
        : window
            .location
            .origin;

    const {
      data,
      error,
    } =
      await supabase.auth.signUp(
        {
          email,

          password:
            authPassword,

          options: {
            data: {
              name,
              status:
                "Online",
            },

            emailRedirectTo:
              redirectUrl,
          },
        }
      );

    setAuthLoading(
      false
    );

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

      setAuthName(
        ""
      );

      setAuthPassword(
        ""
      );

      setAuthConfirmPassword(
        ""
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
  }

  /* =========================================
     LOGIN
  ========================================= */

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

    setAuthLoading(
      true
    );

    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword(
        {
          email,

          password:
            authPassword,
        }
      );

    setAuthLoading(
      false
    );

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

    setAuthPassword(
      ""
    );
  }

  /* =========================================
     REENVIAR CONFIRMAÇÃO
  ========================================= */

  async function resendConfirmation() {
    if (
      !lastSignupEmail
    ) {
      setAuthError(
        "Digite o e-mail da conta."
      );

      return;
    }

    setResendLoading(
      true
    );

    clearAuthMessages();

    const redirectUrl =
      pendingInviteCode
        ? `${
            window
              .location
              .origin
          }/?invite=${encodeURIComponent(
            pendingInviteCode
          )}`
        : window
            .location
            .origin;

    const {
      error,
    } =
      await supabase.auth.resend(
        {
          type:
            "signup",

          email:
            lastSignupEmail,

          options: {
            emailRedirectTo:
              redirectUrl,
          },
        }
      );

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

  /* =========================================
     ESQUECI A SENHA
  ========================================= */

  function openForgotPassword() {
    setRecoveryEmail(
      authEmail.trim()
    );

    setRecoveryError(
      ""
    );

    setRecoverySuccess(
      ""
    );

    setShowForgotPassword(
      true
    );
  }

  function closeForgotPassword() {
    setShowForgotPassword(
      false
    );

    setRecoveryError(
      ""
    );

    setRecoverySuccess(
      ""
    );
  }

  async function handleForgotPassword(
    event: FormEvent
  ) {
    event.preventDefault();

    const email =
      recoveryEmail
        .trim()
        .toLowerCase();

    setRecoveryError(
      ""
    );

    setRecoverySuccess(
      ""
    );

    if (
      !email ||
      !email.includes(
        "@"
      )
    ) {
      setRecoveryError(
        "Digite um e-mail válido."
      );

      return;
    }

    setRecoveryLoading(
      true
    );

    const {
      error,
    } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window
              .location
              .origin,
        }
      );

    setRecoveryLoading(
      false
    );

    if (error) {
      setRecoveryError(
        error.message
      );

      return;
    }

    setRecoverySuccess(
      "Se existir uma conta com esse e-mail, enviaremos um link para redefinir sua senha. Verifique também a pasta de spam."
    );
  }

  async function handleNewPassword(
    event: FormEvent
  ) {
    event.preventDefault();

    setNewPasswordError(
      ""
    );

    if (
      newPassword.length <
      6
    ) {
      setNewPasswordError(
        "A nova senha precisa ter pelo menos 6 caracteres."
      );

      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setNewPasswordError(
        "As senhas não são iguais."
      );

      return;
    }

    setNewPasswordLoading(
      true
    );

    const {
      error,
    } =
      await supabase.auth.updateUser(
        {
          password:
            newPassword,
        }
      );

    if (error) {
      setNewPasswordLoading(
        false
      );

      setNewPasswordError(
        error.message
      );

      return;
    }

    await supabase.auth.signOut();

    setNewPasswordLoading(
      false
    );

    setPasswordRecoveryMode(
      false
    );

    setCurrentUser(
      null
    );

    setAuthUser(
      null
    );

    setNewPassword(
      ""
    );

    setConfirmNewPassword(
      ""
    );

    setAuthMode(
      "login"
    );

    setAuthPassword(
      ""
    );

    setAuthSuccess(
      "Senha alterada com sucesso. Agora entre usando sua nova senha."
    );

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  }

  async function logout() {
    await supabase.auth.signOut();

    setAuthUser(
      null
    );

    setCurrentUser(
      null
    );

    setServers(
      []
    );

    setChannels(
      []
    );

    setMessages(
      []
    );

    setMembers(
      []
    );

    setCurrentServerId(
      null
    );

    setCurrentChannelId(
      null
    );
  }

  /* =========================================
     SERVIDORES
  ========================================= */

  async function loadServers() {
    if (!currentUser) {
      return;
    }

    setAppLoading(
      true
    );

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "servers"
        )
        .select(
          "id,owner_id,name,icon_url,created_at"
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );

    if (error) {
      console.error(
        "Erro ao carregar servidores:",
        error
      );

      setAppLoading(
        false
      );

      return;
    }

    const list =
      (data ||
        []) as Server[];

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
          .from(
            "servers"
          )
          .insert({
            id:
              serverId,

            owner_id:
              currentUser.id,

            name:
              "CONEXÃO",
          });

      if (
        createServerError
      ) {
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
          .from(
            "channels"
          )
          .insert({
            id:
              crypto.randomUUID(),

            server_id:
              serverId,

            name:
              "geral",

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
          .from(
            "servers"
          )
          .select(
            "id,owner_id,name,icon_url,created_at"
          )
          .eq(
            "id",
            serverId
          )
          .single();

      if (
        newServerData
      ) {
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
      (
        previous
      ) => {
        if (
          previous &&
          list.some(
            (
              server
            ) =>
              server.id ===
              previous
          )
        ) {
          return previous;
        }

        return (
          list[0]
            ?.id ||
          null
        );
      }
    );

    setAppLoading(
      false
    );
  }

  /* =========================================
     ENTRAR POR CONVITE
  ========================================= */

  async function processPendingInvite(
    code: string
  ) {
    if (
      !currentUser ||
      !code ||
      inviteProcessingRef.current
    ) {
      return;
    }

    inviteProcessingRef.current =
      true;

    setJoinInviteLoading(
      true
    );

    setJoinInviteError(
      ""
    );

    setJoinInviteSuccess(
      ""
    );

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "join_server_by_invite",
        {
          p_code:
            code,
        }
      );

    localStorage.removeItem(
      "conexao_pending_invite"
    );

    setPendingInviteCode(
      ""
    );

    removeInviteFromUrl();

    if (error) {
      setJoinInviteError(
        error.message
      );

      setJoinInviteLoading(
        false
      );

      inviteProcessingRef.current =
        false;

      await loadServers();

      return;
    }

    await loadServers();

    if (
      typeof data ===
        "string"
    ) {
      setCurrentServerId(
        data
      );

      setCurrentChannelId(
        null
      );

      setChannels(
        []
      );

      setMessages(
        []
      );
    }

    setJoinInviteSuccess(
      "Convite aceito. Você entrou no servidor!"
    );

    setJoinInviteLoading(
      false
    );

    inviteProcessingRef.current =
      false;
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (
      pendingInviteCode
    ) {
      void processPendingInvite(
        pendingInviteCode
      );

      return;
    }

    void loadServers();
  }, [
    currentUser?.id,
    pendingInviteCode,
  ]);

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
        .from(
          "servers"
        )
        .insert({
          id:
            serverId,

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
        .from(
          "channels"
        )
        .insert({
          id:
            crypto.randomUUID(),

          server_id:
            serverId,

          name:
            "geral",

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

    setChannels(
      []
    );

    setMessages(
      []
    );
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

    setInviteMemberError(
      ""
    );

    setInviteMemberSuccess(
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

    setInviteMemberError(
      ""
    );

    setInviteMemberSuccess(
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
        .from(
          "servers"
        )
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
        .from(
          "servers"
        )
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

  /* =========================================
     CRIAR LINK DE CONVITE
  ========================================= */

  function openInviteModal() {
    setInviteLink(
      ""
    );

    setInviteError(
      ""
    );

    setInviteCopied(
      false
    );

    setShowInviteModal(
      true
    );
  }

  function closeInviteModal() {
    setShowInviteModal(
      false
    );

    setInviteLink(
      ""
    );

    setInviteError(
      ""
    );

    setInviteCopied(
      false
    );
  }

  async function createInviteLink() {
    if (
      !currentServer ||
      !isServerOwner
    ) {
      return;
    }

    setInviteLoading(
      true
    );

    setInviteError(
      ""
    );

    setInviteCopied(
      false
    );

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "create_server_invite",
        {
          p_server_id:
            currentServer.id,

          p_expires_hours:
            24,
        }
      );

    setInviteLoading(
      false
    );

    if (error) {
      setInviteError(
        error.message
      );

      return;
    }

    if (
      typeof data !==
        "string" ||
      !data
    ) {
      setInviteError(
        "Não foi possível criar o convite."
      );

      return;
    }

    const baseUrl =
      window.location
        .hostname ===
        "localhost" ||
      window.location
        .hostname ===
        "127.0.0.1"
        ? "https://conexao-jagr.vercel.app"
        : window
            .location
            .origin;

    const url =
      new URL(
        baseUrl
      );

    url.searchParams.set(
      "invite",
      data
    );

    setInviteLink(
      url.toString()
    );
  }

  async function copyInviteLink() {
    if (!inviteLink) {
      return;
    }

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          inviteLink
        );
      } else {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value =
          inviteLink;

        textarea.style.position =
          "fixed";

        textarea.style.opacity =
          "0";

        document.body.appendChild(
          textarea
        );

        textarea.focus();
        textarea.select();

        document.execCommand(
          "copy"
        );

        textarea.remove();
      }

      setInviteCopied(
        true
      );
    } catch {
      setInviteError(
        "Não foi possível copiar o link."
      );
    }
  }

  /* =========================================
     IMAGEM SERVIDOR
  ========================================= */

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
      event.target
        .files?.[0];

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
      10 *
        1024 *
        1024
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
          .from(
            "servers"
          )
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
      .from(
        "servers"
      )
      .update({
        icon_url:
          null,
      })
      .eq(
        "id",
        currentServer.id
      );

    await loadServers();
  }

  /* =========================================
     MEMBROS
  ========================================= */

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
        (
          row
        ) =>
          row.user_id
      );

    if (
      ids.length ===
      0
    ) {
      setMembers(
        []
      );

      return;
    }

    const {
      data:
        profileData,
      error:
        profilesError,
    } =
      await supabase
        .from(
          "profiles"
        )
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

    const result:
      Member[] =
      rows
        .map(
          (
            row
          ) => {
            const profile =
              profiles.find(
                (
                  item
                ) =>
                  item.id ===
                  row.user_id
              );

            if (
              !profile
            ) {
              return null;
            }

            return {
              ...profile,

              role:
                row.role,
            };
          }
        )
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

    setInviteMemberError(
      ""
    );

    setInviteMemberSuccess(
      ""
    );

    if (!email) {
      setInviteMemberError(
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
        .from(
          "profiles"
        )
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
      setInviteMemberError(
        profileError.message
      );

      return;
    }

    if (!profile) {
      setInviteMemberError(
        "Esse usuário ainda não possui conta no CONEXÃO."
      );

      return;
    }

    if (
      profile.id ===
      currentUser?.id
    ) {
      setInviteMemberError(
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
        setInviteMemberError(
          "Esse usuário já está no servidor."
        );
      } else {
        setInviteMemberError(
          error.message
        );
      }

      return;
    }

    setInviteEmail(
      ""
    );

    setInviteMemberSuccess(
      `${profile.name} entrou no servidor.`
    );

    await loadMembers(
      currentServer.id
    );
  }

  /* =========================================
     CANAIS
  ========================================= */

  async function loadChannels(
    serverId: string
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "channels"
        )
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
            ascending:
              true,
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
      (
        previous
      ) => {
        if (
          previous &&
          list.some(
            (
              channel
            ) =>
              channel.id ===
              previous
          )
        ) {
          return previous;
        }

        return (
          list[0]
            ?.id ||
          null
        );
      }
    );
  }

  useEffect(() => {
    if (
      !currentServerId
    ) {
      setChannels(
        []
      );

      setMembers(
        []
      );

      return;
    }

    void loadChannels(
      currentServerId
    );

    void loadMembers(
      currentServerId
    );
  }, [
    currentServerId,
  ]);

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
        .from(
          "channels"
        )
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
        .from(
          "channels"
        )
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
        .from(
          "channels"
        )
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

  /* =========================================
     MENSAGENS
  ========================================= */

  async function fetchMessages(
    channelId: string
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "messages"
        )
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
            ascending:
              true,
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
      rows.length ===
      0
    ) {
      setMessages(
        []
      );

      return;
    }

    const userIds =
      Array.from(
        new Set(
          rows.map(
            (
              row
            ) =>
              row.user_id
          )
        )
      );

    const {
      data:
        profilesData,
    } =
      await supabase
        .from(
          "profiles"
        )
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
          name:
            string;

          avatar_url:
            string | null;
        }
      >();

    for (
      const profile of
      profilesData ||
      []
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

    const finalMessages:
      ChatMessage[] =
      rows.map(
        (
          row
        ) => {
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
        }
      );

    setMessages(
      finalMessages
    );
  }

  useEffect(() => {
    if (
      !currentChannelId
    ) {
      setMessages(
        []
      );

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
            event:
              "INSERT",

            schema:
              "public",

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
  }, [
    currentChannelId,
  ]);

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
        .from(
          "messages"
        )
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

  /* =========================================
     PERFIL
  ========================================= */

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
        .from(
          "profiles"
        )
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
      event.target
        .files?.[0];

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
      10 *
        1024 *
        1024
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
          .from(
            "profiles"
          )
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
      .from(
        "profiles"
      )
      .update({
        avatar_url:
          null,
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

  /* =========================================
     CARREGANDO
  ========================================= */

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

  /* =========================================
     NOVA SENHA
  ========================================= */

  if (
    passwordRecoveryMode
  ) {
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
              Proteja sua conta.
            </p>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>
              Criar nova senha
            </h2>

            <p>
              Digite sua nova senha para continuar.
            </p>
          </div>

          <form
            onSubmit={
              handleNewPassword
            }
          >
            <div className="auth-field">
              <label>
                NOVA SENHA
              </label>

              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={
                  newPassword
                }
                onChange={(
                  event
                ) => {
                  setNewPassword(
                    event.target
                      .value
                  );

                  setNewPasswordError(
                    ""
                  );
                }}
              />
            </div>

            <div className="auth-field">
              <label>
                CONFIRMAR NOVA SENHA
              </label>

              <input
                type="password"
                placeholder="Repita sua nova senha"
                value={
                  confirmNewPassword
                }
                onChange={(
                  event
                ) => {
                  setConfirmNewPassword(
                    event.target
                      .value
                  );

                  setNewPasswordError(
                    ""
                  );
                }}
              />
            </div>

            {newPasswordError && (
              <div className="auth-error">
                {
                  newPasswordError
                }
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={
                newPasswordLoading
              }
            >
              {newPasswordLoading
                ? "Alterando..."
                : "Alterar senha"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* =========================================
     ESQUECI A SENHA
  ========================================= */

  if (
    !currentUser &&
    showForgotPassword
  ) {
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
              Recupere sua conta.
            </p>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>
              Redefinir senha
            </h2>

            <p>
              Enviaremos um link de recuperação para seu e-mail.
            </p>
          </div>

          <form
            onSubmit={
              handleForgotPassword
            }
          >
            <div className="auth-field">
              <label>
                E-MAIL
              </label>

              <input
                type="email"
                autoFocus
                placeholder="voce@email.com"
                value={
                  recoveryEmail
                }
                onChange={(
                  event
                ) => {
                  setRecoveryEmail(
                    event.target
                      .value
                  );

                  setRecoveryError(
                    ""
                  );

                  setRecoverySuccess(
                    ""
                  );
                }}
              />
            </div>

            {recoveryError && (
              <div className="auth-error">
                {
                  recoveryError
                }
              </div>
            )}

            {recoverySuccess && (
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
                  recoverySuccess
                }
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={
                recoveryLoading
              }
            >
              {recoveryLoading
                ? "Enviando..."
                : "Enviar link de recuperação"}
            </button>
          </form>

          <div className="auth-switch">
            Lembrou sua senha?{" "}

            <button
              type="button"
              onClick={
                closeForgotPassword
              }
            >
              Voltar para entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================
     LOGIN / CADASTRO
  ========================================= */

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
              Converse. Crie. Conecte-se.
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

          {pendingInviteCode && (
            <div
              style={{
                marginBottom:
                  "16px",

                padding:
                  "12px",

                border:
                  "1px solid rgba(109,93,252,.3)",

                borderRadius:
                  "12px",

                background:
                  "rgba(109,93,252,.08)",

                color:
                  "#b9c1ff",

                fontSize:
                  "12px",

                lineHeight:
                  1.5,
              }}
            >
              🔗 Você recebeu um convite para um servidor.
              Entre ou crie sua conta para continuar.
            </div>
          )}

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
              "login" && (
              <button
                type="button"
                onClick={
                  openForgotPassword
                }
                style={{
                  width:
                    "100%",

                  border:
                    "none",

                  background:
                    "transparent",

                  color:
                    "#8295ff",

                  textAlign:
                    "right",

                  cursor:
                    "pointer",

                  fontSize:
                    "12px",

                  marginTop:
                    "-2px",

                  marginBottom:
                    "14px",

                  padding:
                    0,
                }}
              >
                Esqueceu sua senha?
              </button>
            )}

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
                width:
                  "100%",

                marginTop:
                  "12px",

                border:
                  "none",

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
                Ainda não tem uma conta?{" "}

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
                Já possui uma conta?{" "}

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

  if (
    joinInviteLoading
  ) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>
              Entrando no servidor...
            </h2>

            <p>
              Estamos validando seu convite.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    appLoading &&
    servers.length ===
      0
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

  /* =========================================
     APP PRINCIPAL
  ========================================= */

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

      {(joinInviteError ||
        joinInviteSuccess) && (
        <div
          style={{
            position:
              "fixed",

            top:
              "18px",

            left:
              "50%",

            transform:
              "translateX(-50%)",

            zIndex:
              9999,

            minWidth:
              "320px",

            maxWidth:
              "520px",

            padding:
              "12px 14px",

            borderRadius:
              "12px",

            border:
              joinInviteError
                ? "1px solid rgba(255,90,90,.35)"
                : "1px solid rgba(70,220,130,.3)",

            background:
              joinInviteError
                ? "rgba(70,15,20,.96)"
                : "rgba(15,55,35,.96)",

            color:
              "#ffffff",

            boxShadow:
              "0 14px 40px rgba(0,0,0,.35)",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            gap:
              "16px",

            fontSize:
              "13px",
          }}
        >
          <span>
            {joinInviteError ||
              joinInviteSuccess}
          </span>

          <button
            type="button"
            onClick={() => {
              setJoinInviteError(
                ""
              );

              setJoinInviteSuccess(
                ""
              );
            }}
            style={{
              border:
                "none",

              background:
                "transparent",

              color:
                "#ffffff",

              cursor:
                "pointer",

              fontSize:
                "18px",
            }}
          >
            ×
          </button>
        </div>
      )}

      <aside className="servers">
        <div className="logo">
          C
        </div>

        {servers.map(
          (
            server
          ) => (
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
                <div
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap:
                      "4px",
                  }}
                >
                  <button
                    className="workspace-settings"
                    onClick={
                      openInviteModal
                    }
                    title="Convidar pessoas"
                  >
                    🔗
                  </button>

                  <button
                    className="workspace-settings"
                    onClick={
                      openEditServer
                    }
                    title="Configurações"
                  >
                    ⚙
                  </button>
                </div>
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
                (
                  channel
                ) => (
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
                            void deleteChannel(
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
                (
                  item
                ) => (
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
                          .charAt(
                            0
                          )
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

      <aside className="members">
        <h3>
          MEMBROS —{" "}
          {
            members.length
          }
        </h3>

        {members.map(
          (
            member
          ) => (
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
                    .charAt(
                      0
                    )
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

      {/* CONVIDAR PESSOAS */}

      {showInviteModal &&
        currentServer && (
        <div
          className="modal-overlay"
          onMouseDown={
            closeInviteModal
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
                  Convidar pessoas
                </h2>

                <p>
                  Crie um link de convite para{" "}
                  {
                    currentServer.name
                  }.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeInviteModal
                }
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  padding:
                    "14px",

                  border:
                    "1px solid #292e3d",

                  borderRadius:
                    "14px",

                  background:
                    "#0e1118",

                  marginBottom:
                    "18px",

                  color:
                    "#8e95a5",

                  fontSize:
                    "12px",

                  lineHeight:
                    1.55,
                }}
              >
                🔗 O link é válido por{" "}
                <strong
                  style={{
                    color:
                      "#fff",
                  }}
                >
                  24 horas
                </strong>
                . Quem abrir poderá entrar no servidor depois de fazer login ou criar uma conta.
              </div>

              {inviteLink ? (
                <>
                  <label>
                    LINK DE CONVITE
                  </label>

                  <div className="friend-add-row">
                    <input
                      type="text"
                      readOnly
                      value={
                        inviteLink
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        void copyInviteLink()
                      }
                    >
                      {inviteCopied
                        ? "Copiado!"
                        : "Copiar"}
                    </button>
                  </div>

                  <p
                    style={{
                      marginTop:
                        "10px",

                      color:
                        "#747c8d",

                      fontSize:
                        "11px",
                    }}
                  >
                    Envie esse link para a pessoa que você quer adicionar.
                  </p>
                </>
              ) : (
                <p
                  style={{
                    color:
                      "#747c8d",

                    fontSize:
                      "12px",
                  }}
                >
                  Clique em{" "}
                  <strong
                    style={{
                      color:
                        "#fff",
                    }}
                  >
                    Gerar link
                  </strong>{" "}
                  para criar um novo convite.
                </p>
              )}

              {inviteError && (
                <p className="modal-error">
                  {
                    inviteError
                  }
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel"
                onClick={
                  closeInviteModal
                }
              >
                Fechar
              </button>

              <button
                className="modal-create"
                onClick={() =>
                  void createInviteLink()
                }
                disabled={
                  inviteLoading
                }
              >
                {inviteLoading
                  ? "Gerando..."
                  : inviteLink
                    ? "Gerar outro link"
                    : "Gerar link"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* CONFIGURAÇÕES */}

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
                  ADICIONAR MEMBRO PELO E-MAIL
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

                      setInviteMemberError(
                        ""
                      );

                      setInviteMemberSuccess(
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

                {inviteMemberError && (
                  <p className="modal-error">
                    {
                      inviteMemberError
                    }
                  </p>
                )}

                {inviteMemberSuccess && (
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
                      inviteMemberSuccess
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
                  maxLength={
                    40
                  }
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