"""El «De:» de los correos de la escuela (06/11/2026): «Holandés Nawar» y la
dirección, también en el correo de Rida al reservar."""

from email.utils import parseaddr

from src.services.email import utils


def test_el_remitente_lleva_el_nombre(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_SYSTEM_EMAIL_NAME", raising=False)
    r = utils.remitente("noreply@mail.holandesnawar.com")
    assert r == '"Holandés Nawar" <noreply@mail.holandesnawar.com>'
    assert parseaddr(r) == ("Holandés Nawar", "noreply@mail.holandesnawar.com")
    # La variable ya trae un nombre: no se mete uno dentro de otro.
    assert utils.remitente("Otra cosa <noreply@mail.holandesnawar.com>") == '"Holandés Nawar" <noreply@mail.holandesnawar.com>'
    monkeypatch.setenv("LEARNHOUSE_SYSTEM_EMAIL_NAME", 'Rida "de" Holandés Nawar')
    assert utils.remitente(" noreply@x.com ") == '"Rida de Holandés Nawar" <noreply@x.com>'


def test_resend_recibe_el_nombre(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_SYSTEM_EMAIL_NAME", raising=False)
    enviado = {}

    class Falso:
        @staticmethod
        def send(datos):
            enviado.update(datos)
            return {"id": "x"}

    monkeypatch.setattr(utils.resend, "Emails", Falso)
    monkeypatch.setattr(utils, "_apuntar_correo", lambda *a, **k: None)

    class Mailing:
        system_email_address = "noreply@mail.holandesnawar.com"
        email_provider = "resend"
        resend_api_key = "re_falsa"

    class Config:
        mailing_config = Mailing()

    monkeypatch.setattr(utils, "get_learnhouse_config", lambda: Config())
    utils.send_email(to="ana@example.com", subject="Un mensaje de Rida", body="<p>Hola</p>", reply_to="info@holandesnawar.com")
    assert enviado["from"] == '"Holandés Nawar" <noreply@mail.holandesnawar.com>'
    assert enviado["reply_to"] == ["info@holandesnawar.com"]
