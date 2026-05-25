from fastapi import HTTPException, status


async def verify_ownership(resource_user_id: int, current_user_id: int):
    if resource_user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
        )
