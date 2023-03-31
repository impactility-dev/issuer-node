package repositories

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	core "github.com/iden3/go-iden3-core"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"

	"github.com/polygonid/sh-id-platform/internal/core/domain"
	"github.com/polygonid/sh-id-platform/internal/core/ports"
	"github.com/polygonid/sh-id-platform/internal/db"
)

var (
	errorShemaNotFound = errors.New("schema id not found")

	// ErrLinkDoesNotExist link does not exist
	ErrLinkDoesNotExist = errors.New("link does not exist")
)

type link struct {
	conn db.Storage
}

// NewLink returns a new connections repository
func NewLink(conn db.Storage) ports.LinkRepository {
	return &link{
		conn,
	}
}

func (l link) Save(ctx context.Context, conn db.Querier, link *domain.Link) (*uuid.UUID, error) {
	pgAttrs := pgtype.JSONB{}
	if err := pgAttrs.Set(link.CredentialAttributes); err != nil {
		return nil, fmt.Errorf("cannot set schema attributes values: %w", err)
	}

	var id uuid.UUID
	sql := `INSERT INTO links (id, issuer_id, max_issuance, valid_until, schema_id, credential_expiration, credential_signature_proof, credential_mtp_proof, credential_attributes, active, issued_claims)
			VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO
			UPDATE SET issuer_id=$2, max_issuance=$3, valid_until=$4, schema_id=$5, credential_expiration=$6, credential_signature_proof=$7, credential_mtp_proof=$8, credential_attributes=$9, active=$10, issued_claims=$11 
			RETURNING id`
	err := conn.QueryRow(ctx, sql, link.ID, link.IssuerCoreDID().String(), link.MaxIssuance, link.ValidUntil, link.SchemaID, link.CredentialExpiration, link.CredentialSignatureProof,
		link.CredentialMTPProof, pgAttrs, link.Active, link.IssuedClaims).Scan(&id)

	if err != nil && strings.Contains(err.Error(), `table "links" violates foreign key constraint "links_schemas_id_key"`) {
		return nil, errorShemaNotFound
	}
	return &id, err
}

func (l link) GetByID(ctx context.Context, issuerDID core.DID, id uuid.UUID) (*domain.Link, error) {
	const sql = `
SELECT links.id, 
       links.issuer_id, 
       links.created_at, 
       links.max_issuance, 
       links.valid_until, 
       links.schema_id, 
       links.credential_expiration, 
       links.credential_signature_proof,
       links.credential_mtp_proof, 
       links.credential_attributes, 
       links.active, 
       links.issued_claims,
       schemas.id as schema_id,
       schemas.issuer_id as schema_issuer_id,
       schemas.url,
       schemas.type,
       schemas.hash,
       schemas.attributes, 
       schemas.created_at
FROM links
LEFT JOIN schemas ON schemas.id = links.schema_id AND schemas.issuer_id = links.issuer_id
WHERE links.id = $1 AND links.issuer_id = $2`
	link := domain.Link{}
	s := dbSchema{}
	var credentialAttributtes pgtype.JSONB
	err := l.conn.Pgx.QueryRow(ctx, sql, id, issuerDID.String()).Scan(
		&link.ID,
		&link.IssuerDID,
		&link.CreatedAt,
		&link.MaxIssuance,
		&link.ValidUntil,
		&link.SchemaID,
		&link.CredentialExpiration,
		&link.CredentialSignatureProof,
		&link.CredentialMTPProof, &credentialAttributtes,
		&link.Active,
		&link.IssuedClaims,
		&s.ID,
		&s.IssuerID,
		&s.URL,
		&s.Type,
		&s.Hash,
		&s.Attributes,
		&s.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrLinkDoesNotExist
	}
	if err != nil {
		return nil, err
	}
	raw, err := credentialAttributtes.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("parsing credential attributes: %w", err)
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	if err := d.Decode(&link.CredentialAttributes); err != nil {
		return nil, fmt.Errorf("parsing credential attributes: %w", err)
	}
	link.Schema, err = toSchemaDomain(&s)
	if err != nil {
		return nil, fmt.Errorf("parsing link schema: %w", err)
	}
	return &link, err
}

func (l link) Delete(ctx context.Context, id uuid.UUID, issuerDID core.DID) error {
	const sql = `DELETE FROM links WHERE id = $1 AND issuer_id =$2`
	cmd, err := l.conn.Pgx.Exec(ctx, sql, id.String(), issuerDID.String())
	if err != nil {
		return err
	}

	if cmd.RowsAffected() == 0 {
		return ErrLinkDoesNotExist
	}
	return nil
}